#!/usr/bin/env node
/**
 * Export carte Oran : PNG 300 dpi par page + PDF propre + PPTX Canva.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import PptxGenJS from "pptxgenjs";

const OUT_DIR =
  "/Users/abdel-kader/Desktop/Asian nour/Asian nour tours/CARTES TOURS/CANVA MODIFIABLE";
const HTML = path.join(OUT_DIR, "CARTE-ORAN-DZ-COMPLETE.html");

/** A4 @ 300 dpi */
const PAGE_W = 2480;
const PAGE_H = 3508;
const SCALE = PAGE_W / 794;

const PAGE_NAMES = [
  "Asian-Nour-Oran-Page-1-Wok",
  "Asian-Nour-Oran-Page-2-Japonaise",
  "Asian-Nour-Oran-Page-3-Specialites",
];

async function renderPages() {
  if (!fs.existsSync(HTML)) {
    throw new Error(`HTML introuvable: ${HTML}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--font-render-hinting=none", "--disable-font-subpixel-positioning"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 820, height: 1200, deviceScaleFactor: SCALE });
    await page.goto(pathToFileURL(HTML).href, {
      waitUntil: "networkidle0",
      timeout: 120_000,
    });

    await page.evaluate(() => {
      document.body.style.background = "#0b0b0b";
      document.body.style.padding = "0";
      document.body.style.margin = "0";
      document.body.style.gap = "0";
      for (const el of document.querySelectorAll(".page")) {
        el.style.boxShadow = "none";
        el.style.margin = "0";
      }
    });

    const handles = await page.$$(".page");
    if (handles.length !== 3) {
      throw new Error(`Attendu 3 pages, trouvé ${handles.length}`);
    }

    const pngPaths = [];
    for (let i = 0; i < handles.length; i++) {
      const pngPath = path.join(OUT_DIR, `${PAGE_NAMES[i]}.png`);
      await handles[i].screenshot({ path: pngPath, type: "png" });
      pngPaths.push(pngPath);
      console.log(`PNG: ${pngPath}`);
    }
    return pngPaths;
  } finally {
    await browser.close();
  }
}

async function buildPdf(pngPaths) {
  const pdfPath = path.join(OUT_DIR, "Asian-Nour-Oran-Menu-Complet-3-pages.pdf");
  const doc = await PDFDocument.create();

  for (const pngPath of pngPaths) {
    const bytes = fs.readFileSync(pngPath);
    const img = await doc.embedPng(bytes);
    const pg = doc.addPage([img.width, img.height]);
    pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }

  fs.writeFileSync(pdfPath, await doc.save());
  console.log(`PDF: ${pdfPath}`);
  return pdfPath;
}

async function buildPptx(pngPaths) {
  const pptxPath = path.join(OUT_DIR, "Asian-Nour-Oran-Menu-Complet-CANVA.pptx");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_4x3";
  pptx.defineLayout({ name: "A4_PORTRAIT", width: 8.27, height: 11.69 });
  pptx.layout = "A4_PORTRAIT";

  for (let i = 0; i < pngPaths.length; i++) {
    const slide = pptx.addSlide();
    slide.addImage({
      path: pngPaths[i],
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
    });
  }

  await pptx.writeFile({ fileName: pptxPath });
  console.log(`PPTX: ${pptxPath}`);
  return pptxPath;
}

const pngPaths = await renderPages();
await buildPdf(pngPaths);
await buildPptx(pngPaths);
console.log("Export Canva terminé.");
