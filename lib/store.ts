import { query, sql, transaction } from "@/lib/db-client";
import type { CertificateTheme } from "@/lib/certificate-template";

export type Student = {
  id: string;
  name: string;
  email: string;
  credentialId: string | null;
  certificateUrl: string | null;
  issuedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // "manual" = an admin added this person by hand (an exception the
  // automatic Week 2/3 lists didn't cover). undefined = came from the
  // computed Week 2 ∩ Week 3 roster. Manual entries are exempt from the
  // requirement check and are never removed by a recompute.
  source?: "manual";
  // Which certificate design was rendered — chosen by the student on the
  // claim page (defaults to "light" until they pick, e.g. for certificates
  // an admin generates before the student ever visits).
  theme: CertificateTheme;
};

export type WeeklySubmission = { email: string; name: string };
export type AssessmentScore = { email: string; score: number };

export type Cohort = {
  id: string;
  courseName: string;
  cohortLabel: string;
  createdAt: string;
  students: Student[];
};

export type CohortSummary = Pick<Cohort, "id" | "courseName" | "cohortLabel" | "createdAt"> & {
  studentCount: number;
  issuedCount: number;
};

function isoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(value as string).toISOString();
}

// Certificate images are served from our own DB-backed route, keyed
// deterministically by credential ID — no need to store/read a URL column.
// The image route sends a long-lived immutable cache header, so a version
// query tied to updated_at is required — otherwise a browser/CDN that
// cached the certificate before a theme switch would keep serving the old
// image at the same URL forever.
function certificateUrlFor(credentialId: string | null, updatedAt: Date | null): string | null {
  if (!credentialId) return null;
  const v = updatedAt ? updatedAt.getTime() : 0;
  return `/api/certificates/${credentialId}?v=${v}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStudentRow(row: any): Student {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    credentialId: row.credential_id,
    certificateUrl: certificateUrlFor(row.credential_id, row.updated_at ?? null),
    issuedAt: row.issued_at ? isoString(row.issued_at) : null,
    revokedAt: row.revoked_at ? isoString(row.revoked_at) : null,
    createdAt: isoString(row.created_at),
    updatedAt: isoString(row.updated_at),
    source: row.source ?? undefined,
    theme: row.theme === "dark" ? "dark" : "light",
  };
}

export async function getWeeklySubmissions(
  cohortId: string,
  week: "week2" | "week3"
): Promise<WeeklySubmission[]> {
  const rows = await query<{ email: string; name: string }>(sql`
    SELECT email, name FROM weekly_submissions
    WHERE cohort_id = ${cohortId} AND week = ${week}
  `);
  return rows.map((r) => ({ email: r.email, name: r.name }));
}

// Used to gate certificate generation for computed-roster students
// (Forms automation, the batch Generate button, the automation endpoint) —
// manually-added students are exempt, callers check student.source first.
// An empty list/array means that requirement hasn't been uploaded yet, so
// it isn't enforced — same convention for week2, week3, and assessmentScores.
export function getMissingRequirements(
  week2: WeeklySubmission[],
  week3: WeeklySubmission[],
  assessmentScores: AssessmentScore[],
  email: string
): string[] {
  const norm = email.trim().toLowerCase();
  const missing: string[] = [];
  if (week2.length > 0 && !week2.some((s) => s.email === norm)) missing.push("Week 2 Project");
  if (week3.length > 0 && !week3.some((s) => s.email === norm)) missing.push("Week 3 Project");
  if (
    assessmentScores.length > 0 &&
    !assessmentScores.some((s) => s.email === norm && s.score > 80)
  ) {
    missing.push("Final Assessment");
  }
  return missing;
}

export async function getAssessmentScores(cohortId: string): Promise<AssessmentScore[]> {
  const rows = await query<{ email: string; score: string }>(sql`
    SELECT email, score FROM assessment_scores WHERE cohort_id = ${cohortId}
  `);
  return rows.map((r) => ({ email: r.email, score: Number(r.score) }));
}

// Fallback path for cohorts not wired up to the Google Forms integration —
// an admin-uploaded CSV of final assessment scores. Re-uploading replaces
// the previous list outright, same as setRequirementList does for week2/3.
export async function setAssessmentScores(
  cohortId: string,
  rows: AssessmentScore[]
): Promise<void> {
  await transaction([
    sql`DELETE FROM assessment_scores WHERE cohort_id = ${cohortId}`,
    ...rows.map(
      (r) => sql`
        INSERT INTO assessment_scores (cohort_id, email, score)
        VALUES (${cohortId}, ${r.email}, ${r.score})
      `
    ),
  ]);
}

// Dashboard-only view — just the counts each cohort card actually shows
// ("N/M issued"), via one aggregate query instead of pulling every student
// row for every cohort (what fetching full Cohort objects here used to do).
export async function listCohortSummaries(): Promise<CohortSummary[]> {
  const rows = await query<{
    id: string;
    course_name: string;
    cohort_label: string;
    created_at: Date;
    student_count: string;
    issued_count: string;
  }>(sql`
    SELECT c.id, c.course_name, c.cohort_label, c.created_at,
           COUNT(s.id) AS student_count,
           COUNT(s.credential_id) AS issued_count
    FROM cohorts c
    LEFT JOIN students s ON s.cohort_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    courseName: r.course_name,
    cohortLabel: r.cohort_label,
    createdAt: isoString(r.created_at),
    studentCount: Number(r.student_count),
    issuedCount: Number(r.issued_count),
  }));
}

export async function getCohort(id: string): Promise<Cohort | null> {
  const cohortRows = await query<{
    id: string;
    course_name: string;
    cohort_label: string;
    created_at: Date;
  }>(sql`SELECT id, course_name, cohort_label, created_at FROM cohorts WHERE id = ${id}`);
  if (cohortRows.length === 0) return null;
  const c = cohortRows[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentRows = await query<any>(
    sql`
      SELECT id, cohort_id, name, email, credential_id,
             certificate_url, issued_at, revoked_at, source, theme, created_at, updated_at
      FROM students WHERE cohort_id = ${id} ORDER BY created_at
    `
  );

  return {
    id: c.id,
    courseName: c.course_name,
    cohortLabel: c.cohort_label,
    createdAt: isoString(c.created_at),
    students: studentRows.map(mapStudentRow),
  };
}

export async function createCohort(input: {
  courseName: string;
  cohortLabel: string;
}): Promise<Cohort> {
  const rows = await query<{
    id: string;
    course_name: string;
    cohort_label: string;
    created_at: Date;
  }>(sql`
    INSERT INTO cohorts (id, course_name, cohort_label)
    VALUES (gen_random_uuid(), ${input.courseName}, ${input.cohortLabel})
    RETURNING id, course_name, cohort_label, created_at
  `);
  const c = rows[0];
  return {
    id: c.id,
    courseName: c.course_name,
    cohortLabel: c.cohort_label,
    createdAt: isoString(c.created_at),
    students: [],
  };
}

export async function upsertRoster(
  cohortId: string,
  rows: { name: string; email: string }[],
  options?: { requireExisting?: boolean }
): Promise<{ created: number; updated: number; skipped: number; cohort: Cohort }> {
  const requireExisting = options?.requireExisting ?? false;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await query<{ id: string }>(
      sql`SELECT id FROM students WHERE cohort_id = ${cohortId} AND email = ${row.email}`
    );
    if (existing.length > 0) {
      await query(sql`
        UPDATE students SET name = ${row.name}, updated_at = now()
        WHERE id = ${existing[0].id}
      `);
      updated++;
    } else if (requireExisting) {
      // The Google Forms automation only ever matches an existing roster
      // entry (from the Week 2/3 lists) — someone who submits the quiz
      // without being on the roster is skipped, not silently enrolled.
      skipped++;
    } else {
      // Reached only for manual adds (requireExisting is only set by the
      // Forms automation, which never creates — see the branch above).
      await query(sql`
        INSERT INTO students (id, cohort_id, name, email, source)
        VALUES (gen_random_uuid(), ${cohortId}, ${row.name}, ${row.email}, 'manual')
      `);
      created++;
    }
  }

  const cohort = await getCohort(cohortId);
  if (!cohort) throw new Error("Cohort not found");
  return { created, updated, skipped, cohort };
}

export async function setRequirementList(
  cohortId: string,
  week: "week2" | "week3",
  submissions: WeeklySubmission[]
): Promise<Cohort> {
  await transaction([
    sql`DELETE FROM weekly_submissions WHERE cohort_id = ${cohortId} AND week = ${week}`,
    ...submissions.map(
      (s) => sql`
        INSERT INTO weekly_submissions (cohort_id, week, email, name)
        VALUES (${cohortId}, ${week}, ${s.email}, ${s.name})
      `
    ),
  ]);

  return recomputeRoster(cohortId);
}

// Rebuilds the computed portion of the roster (students without
// source: "manual") as the Week 2 ∩ Week 3 intersection by email. Manually
// added students are never touched. A computed student who falls out of
// the intersection on a re-upload is removed outright — including if
// they'd already been issued a certificate (their certificate image is
// deleted too), which will make their existing /verify/<credentialId> link
// stop resolving. That's accepted as the cost of the roster always
// reflecting the current lists exactly. If either week hasn't been
// uploaded yet, the intersection is empty and every non-manual student is
// removed — matches "the roster only exists once both lists are in."
async function recomputeRoster(cohortId: string): Promise<Cohort> {
  // The certificate image lives in the same row (certificate_png), so
  // deleting it is automatic — no separate cleanup needed.
  await transaction([
    sql`
      DELETE FROM students
      WHERE cohort_id = ${cohortId}
        AND source IS NULL
        AND email NOT IN (
          SELECT w2.email FROM weekly_submissions w2
          JOIN weekly_submissions w3
            ON w3.cohort_id = ${cohortId} AND w3.week = 'week3' AND w3.email = w2.email
          WHERE w2.cohort_id = ${cohortId} AND w2.week = 'week2'
        )
    `,
    sql`
      INSERT INTO students (id, cohort_id, name, email, source, created_at, updated_at)
      SELECT gen_random_uuid(), ${cohortId},
             COALESCE(NULLIF(w3.name, ''), w2.name),
             w2.email, NULL, now(), now()
      FROM weekly_submissions w2
      JOIN weekly_submissions w3
        ON w3.cohort_id = ${cohortId} AND w3.week = 'week3' AND w3.email = w2.email
      WHERE w2.cohort_id = ${cohortId} AND w2.week = 'week2'
      ON CONFLICT (cohort_id, email) DO UPDATE
        SET name = EXCLUDED.name, updated_at = now()
    `,
  ]);

  const cohort = await getCohort(cohortId);
  if (!cohort) throw new Error("Cohort not found");
  return cohort;
}

export async function markStudentIssued(
  cohortId: string,
  studentId: string,
  data: { credentialId: string; certificatePng: Buffer; issuedAt: string; theme: CertificateTheme }
): Promise<{ credentialId: string; certificateUrl: string; issuedAt: string }> {
  const rows = await query<{ updated_at: Date }>(sql`
    UPDATE students
    SET credential_id = ${data.credentialId}, certificate_png = ${data.certificatePng},
        theme = ${data.theme}, issued_at = ${data.issuedAt}, revoked_at = NULL, updated_at = now()
    WHERE id = ${studentId} AND cohort_id = ${cohortId}
    RETURNING updated_at
  `);
  return {
    credentialId: data.credentialId,
    certificateUrl: certificateUrlFor(data.credentialId, rows[0]?.updated_at ?? null)!,
    issuedAt: data.issuedAt,
  };
}

export async function getCertificateImage(credentialId: string): Promise<Buffer | null> {
  const rows = await query<{ certificate_png: Buffer | null }>(sql`
    SELECT certificate_png FROM students WHERE credential_id = ${credentialId}
  `);
  return rows[0]?.certificate_png ?? null;
}

export async function setStudentRevoked(
  cohortId: string,
  studentId: string,
  revoked: boolean
): Promise<void> {
  const rows = await query<{ id: string }>(sql`
    UPDATE students
    SET revoked_at = ${revoked ? new Date().toISOString() : null}, updated_at = now()
    WHERE id = ${studentId} AND cohort_id = ${cohortId} AND credential_id IS NOT NULL
    RETURNING id
  `);
  if (rows.length > 0) return;

  const exists = await query(
    sql`SELECT 1 FROM students WHERE id = ${studentId} AND cohort_id = ${cohortId}`
  );
  if (exists.length === 0) throw new Error("Student not found");
  throw new Error("Certificate has not been issued yet");
}

export async function deleteStudent(cohortId: string, studentId: string): Promise<void> {
  const rows = await query<{ id: string }>(sql`
    DELETE FROM students WHERE id = ${studentId} AND cohort_id = ${cohortId}
    RETURNING id
  `);
  if (rows.length === 0) throw new Error("Student not found");
}

export async function findByCredentialId(
  credentialId: string
): Promise<{ cohort: Cohort; student: Student } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await query<any>(sql`
    SELECT s.id, s.cohort_id, s.name, s.email, s.credential_id,
           s.certificate_url, s.issued_at, s.revoked_at, s.source, s.theme, s.created_at, s.updated_at,
           c.course_name AS c_course_name,
           c.cohort_label AS c_cohort_label, c.created_at AS c_created_at
    FROM students s JOIN cohorts c ON c.id = s.cohort_id
    WHERE s.credential_id = ${credentialId}
  `);
  if (rows.length === 0) return null;
  const row = rows[0];
  const student = mapStudentRow(row);
  return {
    cohort: {
      id: row.cohort_id,
      courseName: row.c_course_name,
      cohortLabel: row.c_cohort_label,
      createdAt: isoString(row.c_created_at),
      // Only the matched student, not the full roster — enough for callers
      // like generateCertificateForStudent that look the student up by ID.
      students: [student],
    },
    student,
  };
}

