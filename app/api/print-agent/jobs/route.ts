import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAgentToken } from "@/lib/print-agent-auth";
import {
  CUSTOMER_PRINTER_ID,
  EXTRA_PRINTER_ID,
  KITCHEN_PRINTER_ID,
  LEGACY_PRINTER_ID,
} from "@/lib/printer-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOB_MAX_AGE_MS = 30 * 60 * 1000;
const PROCESSING_STALE_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;

function pickPrinter(row: { ip: string; port: number } | null) {
  if (!row) return null;
  return { ip: row.ip, port: row.port };
}

export async function GET(req: Request) {
  const unauthorized = assertAgentToken(req);
  if (unauthorized) return unauthorized;

  const cutoff = new Date(Date.now() - JOB_MAX_AGE_MS);
  const processingStale = new Date(Date.now() - PROCESSING_STALE_MS);

  await prisma.printJob.updateMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    data: { status: "EXPIRED" },
  });

  // Jobs bloqués en PROCESSING (agent crashé) → retenter
  await prisma.printJob.updateMany({
    where: { status: "PROCESSING", createdAt: { lt: processingStale } },
    data: { status: "PENDING" },
  });

  const [kitchenRow, customerRow, extraRow, legacyRow, pendingJobs] = await Promise.all([
    prisma.printerConfig.findUnique({
      where: { id: KITCHEN_PRINTER_ID },
      select: { ip: true, port: true },
    }),
    prisma.printerConfig.findUnique({
      where: { id: CUSTOMER_PRINTER_ID },
      select: { ip: true, port: true },
    }),
    prisma.printerConfig.findUnique({
      where: { id: EXTRA_PRINTER_ID },
      select: { ip: true, port: true },
    }),
    prisma.printerConfig.findUnique({
      where: { id: LEGACY_PRINTER_ID },
      select: { ip: true, port: true },
    }),
    prisma.printJob.findMany({
      where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      select: { id: true, label: true, payload: true, target: true, createdAt: true },
    }),
  ]);

  // Réserve atomiquement chaque job pour un seul agent
  const jobs = [];
  for (const job of pendingJobs) {
    const claimed = await prisma.printJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (claimed.count > 0) jobs.push(job);
  }

  const printers = {
    kitchen: pickPrinter(kitchenRow ?? legacyRow),
    customer: pickPrinter(customerRow),
    extra: pickPrinter(extraRow),
  };

  // Compatibilité anciens agents : une seule imprimante « cuisine »
  const printer = printers.kitchen;

  return NextResponse.json({ printer, printers, jobs });
}
