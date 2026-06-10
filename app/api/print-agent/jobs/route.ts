import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAgentToken } from "@/lib/print-agent-auth";
import { PRINTER_CONFIG_ID } from "@/lib/printer-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Jobs trop anciens : on ne veut pas imprimer une rafale de vieux tickets
// si l'agent a été éteint un moment.
const JOB_MAX_AGE_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;

export async function GET(req: Request) {
  const unauthorized = assertAgentToken(req);
  if (unauthorized) return unauthorized;

  const cutoff = new Date(Date.now() - JOB_MAX_AGE_MS);

  await prisma.printJob.updateMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    data: { status: "EXPIRED" },
  });

  const [printer, jobs] = await Promise.all([
    prisma.printerConfig.findUnique({
      where: { id: PRINTER_CONFIG_ID },
      select: { ip: true, port: true },
    }),
    prisma.printJob.findMany({
      where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      select: { id: true, label: true, payload: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ printer, jobs });
}
