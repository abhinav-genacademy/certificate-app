import { findByCredentialId } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ credentialId: string }>;
}) {
  const { credentialId } = await params;

  const match = await findByCredentialId(credentialId);
  const isRevoked = Boolean(match?.student.revokedAt);
  const isValid = Boolean(match?.student.certificateUrl && match?.student.issuedAt) && !isRevoked;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl flex flex-col gap-6 items-center">
        <div className="text-center">
          <div className="text-[13px] tracking-[6px] text-academy-yellow font-semibold uppercase">
            The Gen Academy
          </div>
          <h1 className="text-2xl font-bold mt-2">Certificate verification</h1>
        </div>

        {!match ? (
          <div className="brand-card p-10 text-center max-w-md">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold">Credential not found</h2>
            <p className="text-muted-grey text-sm mt-2">
              We couldn&apos;t verify a certificate with credential ID{" "}
              <span className="font-mono">{credentialId}</span>.
            </p>
          </div>
        ) : isRevoked ? (
          <div className="brand-card p-10 text-center max-w-md border-red-400/40">
            <div className="text-3xl mb-3">⛔</div>
            <h2 className="text-lg font-bold text-red-400">Credential revoked</h2>
            <p className="text-muted-grey text-sm mt-2">
              This certificate was issued to {match.student.firstName} {match.student.lastName}{" "}
              for {match.cohort.courseName}, but has since been revoked and is no longer valid.
            </p>
            <p className="text-muted-grey text-xs mt-4 font-mono">{credentialId}</p>
          </div>
        ) : !isValid ? (
          <div className="brand-card p-10 text-center max-w-md">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold">Credential not found</h2>
            <p className="text-muted-grey text-sm mt-2">
              We couldn&apos;t verify a certificate with credential ID{" "}
              <span className="font-mono">{credentialId}</span>.
            </p>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 brand-card px-4 py-2 text-academy-yellow text-sm font-semibold">
              ✓ Verified credential
            </div>

            <img
              src={match.student.certificateUrl!}
              alt={`Certificate for ${match.student.firstName} ${match.student.lastName}`}
              className="w-full rounded-lg border border-white/10"
            />

            <div className="brand-card p-6 w-full grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-[2px] text-muted-grey">Recipient</div>
                <div className="mt-1 font-semibold">
                  {match.student.firstName} {match.student.lastName}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[2px] text-muted-grey">Course</div>
                <div className="mt-1 font-semibold">{match.cohort.courseName}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[2px] text-muted-grey">Issued</div>
                <div className="mt-1 font-semibold">
                  {new Date(match.student.issuedAt!).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[2px] text-muted-grey">
                  Credential ID
                </div>
                <div className="mt-1 font-mono">{match.student.credentialId}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
