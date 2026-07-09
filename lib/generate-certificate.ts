import { deriveCredentialId } from "@/lib/credential";
import { generateQrDataUrl } from "@/lib/qr";
import { renderCertificatePng } from "@/lib/certificate-render";
import { writeCertificatePng } from "@/lib/blob-store";
import { markStudentIssued, type Cohort } from "@/lib/store";

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_BASE_URL environment variable is not set");
  }
  return url.replace(/\/$/, "");
}

function formatIssuedDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Takes an already-loaded Cohort rather than a cohortId so callers that just
// wrote/fetched the cohort don't force another Blob lookup right behind
// their own write — list()-backed lookups can lag briefly after a write.
export async function generateCertificateForStudent(cohort: Cohort, studentId: string) {
  const student = cohort.students.find((s) => s.id === studentId);
  if (!student) throw new Error("Student not found");

  const credentialId = student.credentialId ?? deriveCredentialId(cohort.id, studentId);
  const issuedAt = student.issuedAt ? new Date(student.issuedAt) : new Date();
  const verifyUrl = `${getBaseUrl()}/verify/${credentialId}`;
  const qrDataUrl = await generateQrDataUrl(verifyUrl);

  const png = await renderCertificatePng({
    recipientName: `${student.firstName} ${student.lastName}`.trim(),
    courseName: cohort.courseName,
    issuedDateFormatted: formatIssuedDate(issuedAt),
    credentialId,
    qrDataUrl,
  });

  const certificateUrl = await writeCertificatePng(`${credentialId}.png`, png);
  const issuedAtIso = issuedAt.toISOString();

  return markStudentIssued(cohort.id, studentId, {
    credentialId,
    certificateUrl,
    issuedAt: issuedAtIso,
  });
}
