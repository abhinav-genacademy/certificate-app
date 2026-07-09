import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { del, list, put } from "@vercel/blob";

// Cohort/student/submission data now lives in Postgres (lib/store.ts) —
// Blob is only used for the actual certificate PNG images, which it's
// genuinely good at serving via CDN. Locally (no BLOB_READ_WRITE_TOKEN),
// images fall back to /public, so `npm run dev` needs no Blob setup.
const LOCAL_CERT_DIR = join(process.cwd(), "public", "generated-certificates");

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function writeCertificatePng(filename: string, data: Buffer): Promise<string> {
  if (hasBlobToken()) {
    const blob = await put(`certificates/${filename}`, data, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set in this deployment's environment — the filesystem here is read-only, so certificate images can't be saved without it."
    );
  }

  mkdirSync(LOCAL_CERT_DIR, { recursive: true });
  writeFileSync(join(LOCAL_CERT_DIR, filename), data);
  return `/generated-certificates/${filename}`;
}

// Best-effort: a student who never made it past the roster (no credential
// yet) has nothing to delete, and a missing file/blob here shouldn't block
// the caller's actual delete/recompute — swallow "not found," surface
// anything else.
export async function deleteCertificatePng(filename: string): Promise<void> {
  if (hasBlobToken()) {
    const pathname = `certificates/${filename}`;
    const { blobs } = await list({ prefix: pathname, limit: 10 });
    const match = blobs.find((b) => b.pathname === pathname);
    if (match) await del(match.url);
    return;
  }

  const filePath = join(LOCAL_CERT_DIR, filename);
  if (existsSync(filePath)) unlinkSync(filePath);
}
