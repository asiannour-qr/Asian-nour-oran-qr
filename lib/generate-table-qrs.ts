import QRCode from "qrcode";

export type TableQrCode = { table: number; dataUrl: string };

export async function generateTableQrCodes(
  baseUrl: string,
  count: number,
  options?: { scale?: number }
): Promise<TableQrCode[]> {
  const scale = options?.scale ?? 8;
  const arr: TableQrCode[] = [];
  for (let i = 1; i <= count; i += 1) {
    const url = `${baseUrl}/table/${i}`;
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 3,
      scale,
    });
    arr.push({ table: i, dataUrl });
  }
  return arr;
}
