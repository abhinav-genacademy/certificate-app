import { Pool, type QueryResultRow } from "pg";

// Lazy singleton so importing this module never throws at load time (e.g.
// during Next.js's build-time page-data collection) — only actually
// running a query without DATABASE_URL set does.
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    // Neon (and most hosted Postgres) requires TLS but Node's default CA
    // bundle doesn't always validate their chain cleanly from serverless
    // environments; a plain local Postgres (Docker, for dev) has no TLS at
    // all. Permissive-but-encrypted for anything not on localhost.
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

export type SqlQuery = { text: string; values: unknown[] };

// Tagged template that builds a parameterized query descriptor — doesn't
// run anything itself. Pass the result to query() to run it standalone, or
// include it in an array passed to transaction() to run it as part of one.
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  return { text, values };
}

export async function query<T extends QueryResultRow = QueryResultRow>(q: SqlQuery): Promise<T[]> {
  const result = await getPool().query<T>(q.text, q.values);
  return result.rows;
}

// Runs multiple queries atomically on one connection (real BEGIN/COMMIT,
// not the Neon HTTP driver's non-interactive batch form) — later queries in
// the array can't depend on earlier ones' results, but that's never needed
// here (each recomputeRoster query is independent given the same inputs).
export async function transaction<T extends QueryResultRow = QueryResultRow>(
  queries: SqlQuery[]
): Promise<T[][]> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const results: T[][] = [];
    for (const q of queries) {
      const result = await client.query<T>(q.text, q.values);
      results.push(result.rows);
    }
    await client.query("COMMIT");
    return results;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
