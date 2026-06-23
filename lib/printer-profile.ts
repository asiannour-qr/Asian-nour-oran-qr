import { SITE_CONFIG, type SitePrinterProfile } from "@/lib/site";

export function getSitePrinterProfile(): SitePrinterProfile {
  return SITE_CONFIG.printerProfile;
}

export function getEscPosLineWidth(): number {
  return SITE_CONFIG.printerProfile.lineWidth;
}
