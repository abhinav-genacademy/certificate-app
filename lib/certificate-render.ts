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
      // The recipient name and course title are absolutely positioned to
      // match the source design's exact spacing, which assumed short
      // single-line text — an unusually long name/title would otherwise
      // wrap past its box and collide with the elements above/below it.
      // Two constraints, in order: never more than 2 lines (fixed by
      // growing wider first, which these elements stay centered through via
      // left:50%/transform — preferred over shrinking the font), then never
      // taller than the actual pixel gap to the nearest neighbor (fixed by
      // shrinking the font as a last resort). The line-count alone isn't
      // enough: 2 lines at full font size can still be taller than the
      // real space available and collide with the label above/divider
      // below, so maxHeightPx is measured from actual layout, not derived
      // from line-count * font-size.
      await page.evaluate(() => {
        function fitBox(
          selector: string,
          maxLines: number,
          minFontSize: number,
          maxWidth: number,
          maxHeightPx: number
        ) {
          const el = document.querySelector(selector) as HTMLElement | null;
          if (!el) return;
          const lineHeightPx = () => {
            const fontSize = parseFloat(getComputedStyle(el).fontSize);
            const lineHeightRatio = parseFloat(getComputedStyle(el).lineHeight) / fontSize || 1.2;
            return fontSize * lineHeightRatio;
          };
          while (el.scrollHeight > lineHeightPx() * maxLines + 2) {
            const width = el.getBoundingClientRect().width;
            if (width >= maxWidth) break;
            el.style.width = `${Math.min(width + 20, maxWidth)}px`;
          }
          while (el.scrollHeight > maxHeightPx) {
            const fontSize = parseFloat(getComputedStyle(el).fontSize);
            if (fontSize <= minFontSize) break;
            el.style.fontSize = `${fontSize - 2}px`;
          }
        }
        // maxHeightPx: measured gap to the nearest neighbor above/below at
        // each element's top-anchored position, minus a small safety margin.
        fitBox(".recipient-name", 2, 40, 1300, 149);
        fitBox(".course-name", 2, 24, 1300, 54);
      });
      const screenshot = await page.screenshot({ type: "png" });
      return Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  } finally {
    if (ownBrowser) await activeBrowser.close();
  }
}
