import { Pool, type QueryResultRow } from "pg";
import tls from "tls";

// Neon's certificate chains to the public "ISRG Root X1" CA (Let's
// Encrypt) — https://letsencrypt.org/certs/isrgrootx1.pem. Recent Node
// versions trust it by default, but some serverless runtimes ship a
// stale/incomplete bundled CA store that fails to build the chain
// ("unable to verify the first certificate"), which is what motivated
// disabling verification entirely before. Pinning the root explicitly
// (alongside, not instead of, Node's default trusted roots) fixes that
// without giving up certificate validation.
const ISRG_ROOT_X1 = `-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----`;

// Lazy singleton so importing this module never throws at load time (e.g.
// during Next.js's build-time page-data collection) — only actually
// running a query without DATABASE_URL set does.
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    // Neon (and most hosted Postgres) requires TLS; a plain local Postgres
    // (Docker, for dev) has no TLS at all. For anything not on localhost,
    // verify the server's certificate against Node's default trusted roots
    // plus the pinned Neon root above, rather than skipping verification.
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    pool = new Pool({
      connectionString: url,
      ssl: isLocal
        ? false
        : { ca: [...tls.rootCertificates, ISRG_ROOT_X1], rejectUnauthorized: true },
    });
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
