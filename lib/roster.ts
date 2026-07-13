import { parse } from "csv-parse/sync";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

// Raw exports (e.g. Google Forms responses) sometimes repeat a column name
// (two "Email Address" columns) — csv-parse errors on duplicate column
// names by default, so suffix repeats instead of colliding.
function normalizeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const base = normalizeHeader(header);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}__${count}`;
  });
}

function stripDuplicateSuffix(key: string): string {
  return key.replace(/__\d+$/, "");
}

const FIRST_NAME_KEYS = new Set(["firstname", "first"]);
const LAST_NAME_KEYS = new Set(["lastname", "last", "surname"]);
const FULL_NAME_KEYS = new Set(["fullname", "name"]);
const EMAIL_KEYS = new Set(["email", "emailaddress", "e-mail"]);
const SCORE_KEYS = new Set([
  "score",
  "finalscore",
  "assessmentscore",
  "totalscore",
  "percentage",
  "percent",
]);

export type SubmissionRow = { email: string; name: string };

export type SubmissionParseResult = {
  submissions: SubmissionRow[];
  skipped: number;
};

// Parses a project-submission export (e.g. a raw Google Forms response
// CSV) into email + name pairs. Tolerant of extra/duplicate columns and of
// name being split across First/Last columns or combined in one Full Name
// column.
export function parseSubmissionCsv(csvText: string): SubmissionParseResult {
  const records: Record<string, string>[] = parse(csvText, {
    columns: normalizeHeaders,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const byEmail = new Map<string, SubmissionRow>();
  let skipped = 0;

  for (const record of records) {
    let email = "";
    let firstName = "";
    let lastName = "";
    let fullName = "";

    for (const [rawKey, value] of Object.entries(record)) {
      const key = stripDuplicateSuffix(rawKey);
      const trimmed = value?.trim() ?? "";
      if (EMAIL_KEYS.has(key) && !email && trimmed) email = trimmed.toLowerCase();
      else if (FIRST_NAME_KEYS.has(key) && !firstName) firstName = trimmed;
      else if (LAST_NAME_KEYS.has(key) && !lastName) lastName = trimmed;
      else if (FULL_NAME_KEYS.has(key) && !fullName) fullName = trimmed;
    }

    const name = fullName || `${firstName} ${lastName}`.trim();

    if (!email || !EMAIL_RE.test(email)) {
      skipped++;
      continue;
    }

    byEmail.set(email, { email, name });
  }

  return { submissions: Array.from(byEmail.values()), skipped };
}

export type AssessmentRow = { email: string; score: number };

export type AssessmentParseResult = {
  rows: AssessmentRow[];
  skipped: number;
};

// Parses a fallback "final assessment" export — just email + score columns —
// for cohorts not wired up to the Google Forms quiz integration.
export function parseAssessmentCsv(csvText: string): AssessmentParseResult {
  const records: Record<string, string>[] = parse(csvText, {
    columns: normalizeHeaders,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const byEmail = new Map<string, AssessmentRow>();
  let skipped = 0;

  for (const record of records) {
    let email = "";
    let scoreRaw = "";

    for (const [rawKey, value] of Object.entries(record)) {
      const key = stripDuplicateSuffix(rawKey);
      const trimmed = value?.trim() ?? "";
      if (EMAIL_KEYS.has(key) && !email && trimmed) email = trimmed.toLowerCase();
      else if (SCORE_KEYS.has(key) && !scoreRaw && trimmed) scoreRaw = trimmed;
    }

    const score = Number(scoreRaw);
    if (!email || !EMAIL_RE.test(email) || scoreRaw === "" || Number.isNaN(score)) {
      skipped++;
      continue;
    }

    byEmail.set(email, { email, score });
  }

  return { rows: Array.from(byEmail.values()), skipped };
}
