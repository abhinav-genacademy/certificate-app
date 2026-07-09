import QRCode from "qrcode";

export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 0,
    width: 300,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
