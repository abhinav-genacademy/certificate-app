export type CertificateTheme = "light" | "dark";

export type CertificateData = {
  recipientName: string;
  courseName: string;
  issuedDateFormatted: string;
  credentialId: string;
  qrDataUrl: string;
  theme: CertificateTheme;
};

const FOUNDERS = [
  { name: "Aishwarya Srinivasan", title: "Co-Founder" },
  { name: "Arvind Narayanamurthy", title: "Co-Founder" },
];

type Palette = {
  background: string;
  shapeOpacity: number;
  border: string;
  brandName: string;
  headline: string;
  sectionLabel: string;
  bodyLabel: string;
  recipientName: string;
  courseName: string;
  metadataLabel: string;
  metadataValue: string;
  metadataAccent: string;
  signatureInk: string;
  signatureName: string;
  signatureTitle: string;
  badgeBackground: string;
  badgeBorder: string;
  badgeCaption: string;
  icon: string;
};

const PALETTES: Record<CertificateTheme, Palette> = {
  light: {
    background: "linear-gradient(135deg, #FDFCF9 0%, #FAF9F5 55%, #F6F4EC 100%)",
    shapeOpacity: 0.05,
    border: "#C9A227",
    brandName: "#12151C",
    headline: "#12151C",
    sectionLabel: "#B8860B",
    bodyLabel: "#6B7280",
    recipientName: "#B8860B",
    courseName: "#14161C",
    metadataLabel: "#6B7280",
    metadataValue: "#14161C",
    metadataAccent: "#B8860B",
    signatureInk: "#20232B",
    signatureName: "#B8860B",
    signatureTitle: "#6B7280",
    badgeBackground: "#FCFAF3",
    badgeBorder: "#C9A227",
    badgeCaption: "#12151C",
    icon: "#B8860B",
  },
  dark: {
    background: "linear-gradient(160deg, #070911 0%, #0A0D1B 55%, #0C1020 100%)",
    shapeOpacity: 0.08,
    border: "#D4AF37",
    brandName: "#E8C15A",
    headline: "#F5F1E6",
    sectionLabel: "#D4AF37",
    bodyLabel: "#ADB3C4",
    recipientName: "#E9CB8B",
    courseName: "#F2C94C",
    metadataLabel: "#C7A046",
    metadataValue: "#F5F1E6",
    metadataAccent: "#E9CB8B",
    signatureInk: "#F5F1E6",
    signatureName: "#E9CB8B",
    signatureTitle: "#ADB3C4",
    badgeBackground: "#FBF8EF",
    badgeBorder: "#D4AF37",
    badgeCaption: "#12151C",
    icon: "#D4AF37",
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bulbIcon(color: string): string {
  return `
  <svg width="52" height="60" viewBox="0 0 52 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="${color}" stroke-width="1.6" stroke-linecap="round">
      <line x1="26" y1="2" x2="26" y2="10" />
      <line x1="10" y1="8" x2="15" y2="14" />
      <line x1="42" y1="8" x2="37" y2="14" />
      <line x1="4" y1="24" x2="12" y2="24" />
      <line x1="48" y1="24" x2="40" y2="24" />
      <path d="M16 24c0-8 5-13 10-13s10 5 10 13c0 6-3 9-5 11.5-1 1.2-1.5 2.5-1.5 4v2h-7v-2c0-1.5-.5-2.8-1.5-4C19 33 16 30 16 24z" />
      <path d="M20 25c1-3 2-5 6-5M32 25c-1-3-2-5-6-5" stroke-width="1.3" />
      <line x1="20" y1="41.5" x2="32" y2="41.5" />
      <line x1="21" y1="45.5" x2="31" y2="45.5" />
    </g>
  </svg>`;
}

function calendarIcon(color: string): string {
  return `
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="6" width="24" height="21" rx="2.5" />
      <line x1="3" y1="12" x2="27" y2="12" />
      <line x1="9" y1="2.5" x2="9" y2="8" />
      <line x1="21" y1="2.5" x2="21" y2="8" />
    </g>
  </svg>`;
}

function idIcon(color: string): string {
  return `
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2 4 6.5v7c0 8 5 12.5 11 14.5 6-2 11-6.5 11-14.5v-7L15 2z" />
      <circle cx="15" cy="13.5" r="3.2" />
      <path d="M9.5 20.5c1.4-2.6 3.4-3.8 5.5-3.8s4.1 1.2 5.5 3.8" />
    </g>
  </svg>`;
}

function shieldCheckIcon(color: string): string {
  return `
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2.5 4 6v6.5c0 7 4.3 10.8 9 12 4.7-1.2 9-5 9-12V6l-9-3.5z" />
      <path d="M9 13.2l2.7 2.7 5.3-5.6" />
    </g>
  </svg>`;
}

export function buildCertificateHtml(data: CertificateData): string {
  const recipientName = escapeHtml(data.recipientName);
  const courseName = escapeHtml(data.courseName);
  const issuedDateFormatted = escapeHtml(data.issuedDateFormatted);
  const credentialId = escapeHtml(data.credentialId);
  const p = PALETTES[data.theme];

  const signatures = FOUNDERS.map(
    (f) => `
        <div class="signature-block">
          <div class="signature-script">${escapeHtml(f.name)}</div>
          <div class="signature-line"></div>
          <div class="signature-name">${escapeHtml(f.name.toUpperCase())}</div>
          <div class="signature-title">${escapeHtml(f.title.toUpperCase())}</div>
          <div class="signature-title">THE GEN ACADEMY</div>
        </div>`
  ).join(`<div class="signature-divider"></div>`);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700;800&family=Dancing+Script:wght@700&display=swap"
  rel="stylesheet"
/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body { width: 1600px; height: 1000px; }

  .certificate {
    width: 1600px;
    height: 1000px;
    position: relative;
    background: ${p.background};
    font-family: "Inter", Helvetica, Arial, sans-serif;
    overflow: hidden;
  }

  .shape-a, .shape-b {
    position: absolute;
    opacity: ${p.shapeOpacity};
    background: linear-gradient(135deg, #8A8FA3, transparent);
  }
  .shape-a { top: -220px; right: -180px; width: 620px; height: 620px; transform: rotate(35deg); }
  .shape-b { bottom: -260px; left: -200px; width: 560px; height: 560px; transform: rotate(35deg); }

  .frame {
    position: absolute;
    inset: 44px;
    border: 1.5px solid ${p.border};
    border-radius: 4px;
  }

  .corner {
    position: absolute;
    width: 34px;
    height: 34px;
    border: 2px solid ${p.border};
  }
  .corner-tl { top: 28px; left: 28px; border-right: none; border-bottom: none; }
  .corner-tr { top: 28px; right: 28px; border-left: none; border-bottom: none; }
  .corner-bl { bottom: 28px; left: 28px; border-right: none; border-top: none; }
  .corner-br { bottom: 28px; right: 28px; border-left: none; border-top: none; }

  .diamond {
    position: absolute;
    width: 9px;
    height: 9px;
    background: ${p.border};
    transform: translateX(-50%) rotate(45deg);
  }
  .diamond-bottom { left: 50%; bottom: 40px; }

  .content {
    position: relative;
    z-index: 2;
    height: 100%;
    /* Frame sits at inset:44px — bottom padding must clear that with real
       room to spare, or the bottom row (metadata, signatures, QR badge)
       ends up flush against the border. */
    padding: 64px 100px 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .brand-block { display: flex; flex-direction: column; align-items: center; }

  .brand-name {
    margin-top: 6px;
    font-size: 21px;
    letter-spacing: 6px;
    font-weight: 700;
    text-transform: uppercase;
    color: ${p.brandName};
  }

  .headline {
    margin-top: 30px;
    font-family: "Playfair Display", Georgia, serif;
    font-size: 76px;
    font-weight: 800;
    letter-spacing: 4px;
    color: ${p.headline};
  }

  .subhead-row {
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .subhead-line { width: 90px; height: 1px; background: ${p.border}; }
  .subhead {
    font-size: 21px;
    letter-spacing: 7px;
    font-weight: 600;
    text-transform: uppercase;
    color: ${p.sectionLabel};
  }

  .tick {
    margin-top: 12px;
    width: 1px;
    height: 16px;
    background: ${p.border};
    position: relative;
  }
  .tick::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -5px;
    width: 7px;
    height: 7px;
    background: ${p.border};
    transform: translateX(-50%) rotate(45deg);
  }

  .awarded-label {
    margin-top: 26px;
    font-size: 15px;
    letter-spacing: 4px;
    font-weight: 600;
    text-transform: uppercase;
    color: ${p.bodyLabel};
  }

  .recipient-name {
    margin-top: 12px;
    font-family: "Playfair Display", Georgia, serif;
    font-size: 68px;
    font-weight: 700;
    color: ${p.recipientName};
  }

  .name-divider {
    margin-top: 18px;
    width: 280px;
    height: 1px;
    background: ${p.border};
    position: relative;
  }
  .name-divider::after {
    content: "";
    position: absolute;
    left: 50%;
    top: -4px;
    width: 8px;
    height: 8px;
    background: ${p.border};
    transform: translateX(-50%) rotate(45deg);
  }

  .completion-label {
    margin-top: 22px;
    font-size: 15px;
    letter-spacing: 1px;
    color: ${p.bodyLabel};
  }

  .course-name {
    margin-top: 10px;
    font-size: 40px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${p.courseName};
  }

  .conducted-label {
    margin-top: 8px;
    font-size: 15px;
    color: ${p.bodyLabel};
  }

  .bottom-row {
    margin-top: auto;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }

  .metadata-stack { display: flex; flex-direction: column; gap: 18px; }

  .metadata-item { display: flex; align-items: center; gap: 12px; }

  .metadata-text { display: flex; flex-direction: column; gap: 3px; }

  .metadata-label {
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: ${p.metadataLabel};
  }

  .metadata-value {
    font-size: 20px;
    font-weight: 700;
    color: ${p.metadataValue};
  }
  .metadata-value.accent { color: ${p.metadataAccent}; }

  .signature-row {
    display: flex;
    align-items: flex-start;
    gap: 40px;
  }

  .signature-block { display: flex; flex-direction: column; align-items: flex-start; width: 300px; }

  .signature-divider { width: 1px; align-self: stretch; background: rgba(150,150,150,0.35); margin-top: 4px; }

  .signature-script {
    font-family: "Dancing Script", cursive;
    font-size: 27px;
    font-weight: 700;
    color: ${p.signatureInk};
    white-space: nowrap;
  }

  .signature-line {
    margin-top: 8px;
    width: 100%;
    height: 1px;
    background: rgba(150,150,150,0.4);
  }

  .signature-name {
    margin-top: 10px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: ${p.signatureName};
  }

  .signature-title {
    margin-top: 2px;
    font-size: 12px;
    letter-spacing: 1px;
    color: ${p.signatureTitle};
  }

  .verify-column { display: flex; flex-direction: column; align-items: center; width: 132px; }

  .verify-badge {
    width: 132px;
    padding: 14px 12px 30px;
    background: ${p.badgeBackground};
    border: 1.5px solid ${p.badgeBorder};
    clip-path: polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .verify-badge img { width: 104px; height: 104px; display: block; }

  .verify-icon { margin-top: 10px; }

  .verify-caption {
    margin-top: 4px;
    font-size: 11px;
    letter-spacing: 1px;
    font-weight: 700;
    text-transform: uppercase;
    color: ${p.sectionLabel};
    text-align: center;
  }
</style>
</head>
<body>
  <section class="certificate">
    <div class="shape-a"></div>
    <div class="shape-b"></div>
    <div class="frame"></div>
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>
    <div class="diamond diamond-bottom"></div>

    <div class="content">
      <div class="brand-block">
        ${bulbIcon(p.icon)}
        <div class="brand-name">THE GEN ACADEMY</div>
      </div>

      <div class="headline">CERTIFICATE</div>
      <div class="subhead-row">
        <div class="subhead-line"></div>
        <div class="subhead">OF COMPLETION</div>
        <div class="subhead-line"></div>
      </div>
      <div class="tick"></div>

      <div class="awarded-label">THIS IS PROUDLY AWARDED TO</div>
      <div class="recipient-name">${recipientName}</div>
      <div class="name-divider"></div>

      <div class="completion-label">for successfully completing the masterclass</div>
      <div class="course-name">${courseName}</div>
      <div class="conducted-label">conducted by The Gen Academy.</div>

      <div class="bottom-row">
        <div class="metadata-stack">
          <div class="metadata-item">
            ${calendarIcon(p.icon)}
            <div class="metadata-text">
              <div class="metadata-label">Date of Completion</div>
              <div class="metadata-value">${issuedDateFormatted}</div>
            </div>
          </div>
          <div class="metadata-item">
            ${idIcon(p.icon)}
            <div class="metadata-text">
              <div class="metadata-label">Certificate ID</div>
              <div class="metadata-value accent">${credentialId}</div>
            </div>
          </div>
        </div>

        <div class="signature-row">
          ${signatures}
        </div>

        <div class="verify-column">
          <div class="verify-badge">
            <img src="${data.qrDataUrl}" alt="Verify certificate QR code" />
          </div>
          <div class="verify-icon">${shieldCheckIcon(p.icon)}</div>
          <div class="verify-caption">Verify Authenticity</div>
        </div>
      </div>
    </div>
  </section>
</body>
</html>`;
}
