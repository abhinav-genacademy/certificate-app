export type CertificateData = {
  recipientName: string;
  courseName: string;
  issuedDateFormatted: string;
  credentialId: string;
  qrDataUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildCertificateHtml(data: CertificateData): string {
  const recipientName = escapeHtml(data.recipientName);
  const courseName = escapeHtml(data.courseName);
  const issuedDateFormatted = escapeHtml(data.issuedDateFormatted);
  const credentialId = escapeHtml(data.credentialId);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 1600px;
    height: 1000px;
  }

  .certificate {
    width: 1600px;
    height: 1000px;
    position: relative;
    background: #000000;
    padding: 32px;
    font-family: "Inter", Helvetica, Arial, sans-serif;
  }

  .certificate-card {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 20px;
    overflow: hidden;
    color: #FFFFFF;
    background:
      linear-gradient(135deg, rgba(254,251,65,0.08), rgba(7,17,31,0.10) 28%, rgba(11,16,32,0.65)),
      radial-gradient(circle at 82% 80%, rgba(80,70,160,0.16), transparent 34%),
      linear-gradient(180deg, #05070D 0%, #07111F 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 100px;
  }

  .certificate-grid {
    position: absolute;
    inset: 0;
    opacity: 0.5;
    background-image:
      linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 48px 48px;
  }

  .certificate-border {
    position: absolute;
    inset: 16px;
    border: 1.5px solid #FEFB41;
    border-radius: 14px;
  }

  .certificate-content {
    position: relative;
    z-index: 2;
    text-align: center;
  }

  .brand-name {
    font-size: 24px;
    letter-spacing: 7px;
    font-weight: 600;
    text-transform: uppercase;
    color: #FEFB41;
  }

  .certificate-title {
    margin-top: 44px;
    font-size: 26px;
    letter-spacing: 6px;
    font-weight: 500;
    text-transform: uppercase;
    color: #B9C0CC;
  }

  .certifies-label,
  .completion-label {
    font-size: 16px;
    letter-spacing: 4px;
    font-weight: 500;
    text-transform: uppercase;
    color: #9096A2;
  }

  .certifies-label { margin-top: 44px; }
  .completion-label { margin-top: 44px; }

  .recipient-name {
    margin-top: 22px;
    font-family: "Playfair Display", Georgia, serif;
    font-size: 72px;
    line-height: 1.15;
    font-weight: 700;
    color: #FAF7F0;
    text-align: center;
  }

  .name-divider {
    width: 320px;
    height: 1px;
    margin: 28px auto 0;
    background: #FEFB41;
  }

  .course-name {
    margin-top: 14px;
    font-size: 32px;
    line-height: 1.2;
    font-weight: 700;
    color: #FFFFFF;
  }

  .bottom-row {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 0 64px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }

  .metadata-stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .metadata-label {
    font-size: 14px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #9096A2;
  }

  .metadata-value {
    margin-top: 7px;
    font-size: 23px;
    font-weight: 700;
    color: #FFFFFF;
  }

  .qr-frame {
    width: 130px;
    height: 130px;
    padding: 9px;
    border-radius: 10px;
    background: #FFFFFF;
  }

  .qr-frame img {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
</head>
<body>
  <section class="certificate">
    <div class="certificate-card">
      <div class="certificate-grid"></div>
      <div class="certificate-border"></div>

      <div class="certificate-content">
        <div class="brand-name">THE GEN ACADEMY</div>

        <div class="certificate-title">CERTIFICATE OF COMPLETION</div>

        <div class="certifies-label">THIS CERTIFIES THAT</div>
        <div class="recipient-name">${recipientName}</div>

        <div class="name-divider"></div>

        <div class="completion-label">HAS SUCCESSFULLY COMPLETED</div>
        <div class="course-name">${courseName}</div>
      </div>

      <div class="bottom-row">
        <div class="metadata-stack">
          <div class="metadata-block">
            <div class="metadata-label">ISSUED</div>
            <div class="metadata-value">${issuedDateFormatted}</div>
          </div>

          <div class="metadata-block">
            <div class="metadata-label">CREDENTIAL ID</div>
            <div class="metadata-value">${credentialId}</div>
          </div>
        </div>

        <div class="qr-frame">
          <img src="${data.qrDataUrl}" alt="Verify certificate QR code" />
        </div>
      </div>
    </div>
  </section>
</body>
</html>`;
}
