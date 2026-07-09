import { query, sql, transaction } from "@/lib/db-client";
import { deleteCertificatePng } from "@/lib/blob-store";

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
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
};

export type WeeklySubmission = { email: string; firstName: string; lastName: string };

export type Cohort = {
  id: string;
  courseName: string;
  cohortLabel: string;
  createdAt: string;
  students: Student[];
};

export type CohortSummary = Pick<Cohort, "id" | "courseName" | "cohortLabel" | "createdAt">;

function isoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(value as string).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStudentRow(row: any): Student {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    credentialId: row.credential_id,
    certificateUrl: row.certificate_url,
    issuedAt: row.issued_at ? isoString(row.issued_at) : null,
    revokedAt: row.revoked_at ? isoString(row.revoked_at) : null,
    createdAt: isoString(row.created_at),
    updatedAt: isoString(row.updated_at),
    source: row.source ?? undefined,
  };
}

export async function getWeeklySubmissions(
  cohortId: string,
  week: "week2" | "week3"
): Promise<WeeklySubmission[]> {
  const rows = await query<{ email: string; first_name: string; last_name: string }>(sql`
    SELECT email, first_name, last_name FROM weekly_submissions
    WHERE cohort_id = ${cohortId} AND week = ${week}
  `);
  return rows.map((r) => ({ email: r.email, firstName: r.first_name, lastName: r.last_name }));
}

// Used to gate certificate generation for computed-roster students
// (Forms automation, the batch Generate button, the public claim page) —
// manually-added students are exempt, callers check student.source first.
// An empty list for a week means it hasn't been uploaded yet, so it isn't
// enforced.
export function getMissingRequirements(
  week2: WeeklySubmission[],
  week3: WeeklySubmission[],
  email: string
): string[] {
  const norm = email.trim().toLowerCase();
  const missing: string[] = [];
  if (week2.length > 0 && !week2.some((s) => s.email === norm)) missing.push("Week 2 Project");
  if (week3.length > 0 && !week3.some((s) => s.email === norm)) missing.push("Week 3 Project");
  return missing;
}

export async function listCohortSummaries(): Promise<CohortSummary[]> {
  const rows = await query<{
    id: string;
    course_name: string;
    cohort_label: string;
    created_at: Date;
  }>(sql`SELECT id, course_name, cohort_label, created_at FROM cohorts ORDER BY created_at DESC`);
  return rows.map((r) => ({
    id: r.id,
    courseName: r.course_name,
    cohortLabel: r.cohort_label,
    createdAt: isoString(r.created_at),
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
    sql`SELECT * FROM students WHERE cohort_id = ${id} ORDER BY created_at`
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
  rows: { firstName: string; lastName: string; email: string }[],
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
        UPDATE students SET first_name = ${row.firstName}, last_name = ${row.lastName}, updated_at = now()
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
        INSERT INTO students (id, cohort_id, first_name, last_name, email, source)
        VALUES (gen_random_uuid(), ${cohortId}, ${row.firstName}, ${row.lastName}, ${row.email}, 'manual')
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
        INSERT INTO weekly_submissions (cohort_id, week, email, first_name, last_name)
        VALUES (${cohortId}, ${week}, ${s.email}, ${s.firstName}, ${s.lastName})
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
  const results = await transaction<{ credential_id: string | null }>([
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
      RETURNING credential_id
    `,
    sql`
      INSERT INTO students (id, cohort_id, first_name, last_name, email, source, created_at, updated_at)
      SELECT gen_random_uuid(), ${cohortId},
             COALESCE(NULLIF(w3.first_name, ''), w2.first_name),
             COALESCE(NULLIF(w3.last_name, ''), w2.last_name),
             w2.email, NULL, now(), now()
      FROM weekly_submissions w2
      JOIN weekly_submissions w3
        ON w3.cohort_id = ${cohortId} AND w3.week = 'week3' AND w3.email = w2.email
      WHERE w2.cohort_id = ${cohortId} AND w2.week = 'week2'
      ON CONFLICT (cohort_id, email) DO UPDATE
        SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, updated_at = now()
    `,
  ]);

  const removed = results[0];
  for (const row of removed) {
    if (row.credential_id) await deleteCertificatePng(`${row.credential_id}.png`);
  }

  const cohort = await getCohort(cohortId);
  if (!cohort) throw new Error("Cohort not found");
  return cohort;
}

export async function markStudentIssued(
  cohortId: string,
  studentId: string,
  data: { credentialId: string; certificateUrl: string; issuedAt: string }
): Promise<{ credentialId: string; certificateUrl: string; issuedAt: string }> {
  await query(sql`
    UPDATE students
    SET credential_id = ${data.credentialId}, certificate_url = ${data.certificateUrl},
        issued_at = ${data.issuedAt}, revoked_at = NULL, updated_at = now()
    WHERE id = ${studentId} AND cohort_id = ${cohortId}
  `);
  return data;
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
  const rows = await query<{ credential_id: string | null }>(sql`
    DELETE FROM students WHERE id = ${studentId} AND cohort_id = ${cohortId}
    RETURNING credential_id
  `);
  if (rows.length === 0) throw new Error("Student not found");
  if (rows[0].credential_id) await deleteCertificatePng(`${rows[0].credential_id}.png`);
}

export async function findByCredentialId(
  credentialId: string
): Promise<{ cohort: Cohort; student: Student } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await query<any>(sql`
    SELECT s.*, c.course_name AS c_course_name,
           c.cohort_label AS c_cohort_label, c.created_at AS c_created_at
    FROM students s JOIN cohorts c ON c.id = s.cohort_id
    WHERE s.credential_id = ${credentialId}
  `);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    cohort: {
      id: row.cohort_id,
      courseName: row.c_course_name,
      cohortLabel: row.c_cohort_label,
      createdAt: isoString(row.c_created_at),
      students: [],
    },
    student: mapStudentRow(row),
  };
}

export async function findByIdentity(
  firstName: string,
  lastName: string,
  email: string
): Promise<{ cohort: Cohort; student: Student }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await query<any>(sql`
    SELECT s.*, c.course_name AS c_course_name,
           c.cohort_label AS c_cohort_label, c.created_at AS c_created_at
    FROM students s JOIN cohorts c ON c.id = s.cohort_id
    WHERE lower(s.email) = lower(${email})
      AND lower(s.first_name) = lower(${firstName})
      AND lower(s.last_name) = lower(${lastName})
  `);
  return rows.map((row) => ({
    cohort: {
      id: row.cohort_id,
      courseName: row.c_course_name,
      cohortLabel: row.c_cohort_label,
      createdAt: isoString(row.c_created_at),
      students: [],
    },
    student: mapStudentRow(row),
  }));
}
