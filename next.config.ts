import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, Next's server bundler inlines/relocates these packages,
  // which strips @sparticuz/chromium's bin/ directory (the actual Chromium
  // binary) out of the deployed function — certificate rendering then fails
  // at runtime with "input directory .../chromium/bin does not exist".
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // serverExternalPackages only controls JS bundling — Vercel's separate
  // file-tracing step still needs to be told explicitly to copy the
  // chromium binary files into the deployed function, since it isn't
  // detected by static analysis of the code.
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/@sparticuz/chromium/**/*"],
  },
};

export default nextConfig;
