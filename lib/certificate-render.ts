import type { Browser } from "puppeteer-core";
import { buildCertificateHtml, type CertificateData } from "@/lib/certificate-template";

const WIDTH = 1600;
const HEIGHT = 1000;

async function launchBrowser(): Promise<Browser> {
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

export async function renderCertificatePng(data: CertificateData): Promise<Buffer> {
  const html = buildCertificateHtml(data);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.screenshot({ type: "png" });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}
