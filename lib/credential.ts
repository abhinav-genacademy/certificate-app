import { createHash } from "crypto";

// Excludes ambiguous characters (0/O, 1/I/L) so IDs are easy to read and type.
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 10;

// Deterministic, not random: two concurrent requests generating a
// certificate for the same student (their own claim-page check and an
// admin's Generate click landing around the same time, say) must compute
// the identical ID so they converge on one certificate instead of each
// producing a different one and racing to decide which "wins" in storage.
// Collisions between different (cohortId, studentId) pairs are negligible
// at this ID length (32^10 possibilities) for any realistic student count.
export function deriveCredentialId(cohortId: string, studentId: string): string {
  const hash = createHash("sha256").update(`${cohortId}:${studentId}`).digest();
  let id = "";
  for (let i = 0; i < LENGTH; i++) {
    id += CHARSET[hash[i] % CHARSET.length];
  }
  return id;
}
