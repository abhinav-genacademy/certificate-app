import { NextRequest, NextResponse } from "next/server";
import { getCertificateImage } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  const { credentialId } = await params;
  const png = await getCertificateImage(credentialId);
  if (!png) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
