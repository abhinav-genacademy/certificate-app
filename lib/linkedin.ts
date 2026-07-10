export function buildLinkedInAddUrl(params: {
  courseName: string;
  credentialId: string;
  verifyUrl: string;
  issuedAt: Date;
}): string {
  const search = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: params.courseName,
    organizationName: "The Gen Academy",
    issueYear: String(params.issuedAt.getFullYear()),
    issueMonth: String(params.issuedAt.getMonth() + 1),
    certUrl: params.verifyUrl,
    certId: params.credentialId,
  });
  return `https://www.linkedin.com/profile/add?${search.toString()}`;
}
