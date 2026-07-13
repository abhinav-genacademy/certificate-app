import type { Browser } from "puppeteer-core";
import { buildCertificateHtml, type CertificateData } from "@/lib/certificate-template";

const WIDTH = 1600;
const HEIGHT = 1000;

// Exported so batch callers (e.g. the admin generate route processing
// several students in one request) can launch one browser and reuse it
// across renders instead of paying Chromium's startup cost per certificate
// — often the single biggest cost of generating more than one at a time.
export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Promise<Browser>;
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.launch({ headless: true }) as unknown as Promise<Browser>;
}

// Pass an already-launched `browser` to reuse it (caller owns its lifecycle
// — this won't close it). Without one, launches and closes its own, same as
// before, for callers rendering just a single certificate.
export async function renderCertificatePng(
  data: CertificateData,
  browser?: Browser
): Promise<Buffer> {
  const html = buildCertificateHtml(data);
  const ownBrowser = !browser;
  const activeBrowser = browser ?? (await launchBrowser());
  try {
    const page = await activeBrowser.newPage();
    try {
      await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const screenshot = await page.screenshot({ type: "png" });
      return Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  } finally {
    if (ownBrowser) await activeBrowser.close();
  }
}
