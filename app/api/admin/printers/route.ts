import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";
import {
  CUSTOMER_PRINTER_ID,
  DEFAULT_PRINTER_PORT,
  EXTRA_PRINTER_ID,
  KITCHEN_PRINTER_ID,
  LEGACY_PRINTER_ID,
  normalizePrinterIp,
  parsePrinterPort,
  parsePrinterRole,
  printerIdForTarget,
  type PrinterTarget,
} from "@/lib/printer-config";
import { getSitePrinterProfile } from "@/lib/printer-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serializeConfig(row: { ip: string; port: number; updatedAt: Date } | null) {
  if (!row) return null;
  return { ip: row.ip, port: row.port, updatedAt: row.updatedAt.toISOString() };
}

export async function GET() {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  try {
    const [kitchen, customer, extra, legacy] = await Promise.all([
      prisma.printerConfig.findUnique({ where: { id: KITCHEN_PRINTER_ID } }),
      prisma.printerConfig.findUnique({ where: { id: CUSTOMER_PRINTER_ID } }),
      prisma.printerConfig.findUnique({ where: { id: EXTRA_PRINTER_ID } }),
      prisma.printerConfig.findUnique({ where: { id: LEGACY_PRINTER_ID } }),
    ]);

    const profile = getSitePrinterProfile();
    return NextResponse.json({
      kitchen: serializeConfig(kitchen ?? legacy),
      customer: serializeConfig(customer),
      extra: serializeConfig(extra),
      defaults: { port: profile.defaultPort ?? DEFAULT_PRINTER_PORT },
      profile,
    });
  } catch (error: unknown) {
    console.error("[admin/printers/GET]", error);
    return NextResponse.json({ error: "Impossible de charger la configuration" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let body: { role?: unknown; ip?: unknown; port?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const target: PrinterTarget = parsePrinterRole(body.role) ?? "kitchen";
  const configId = printerIdForTarget(target);

  const ipRaw = typeof body.ip === "string" ? body.ip.trim() : "";

  if (target === "extra" && !ipRaw) {
    try {
      await prisma.printerConfig.deleteMany({ where: { id: EXTRA_PRINTER_ID } });
      return NextResponse.json({ role: target, config: null });
    } catch (error: unknown) {
      console.error("[admin/printers/PUT]", error);
      return NextResponse.json({ error: "Impossible de supprimer la configuration" }, { status: 500 });
    }
  }

  const ip = normalizePrinterIp(ipRaw);
  if (!ip) {
    return NextResponse.json({ error: "Adresse IP invalide (format IPv4 attendu)" }, { status: 400 });
  }

  const port = parsePrinterPort(body.port ?? DEFAULT_PRINTER_PORT);
  if (port === null) {
    return NextResponse.json({ error: "Port invalide (1–65535)" }, { status: 400 });
  }

  try {
    const config = await prisma.printerConfig.upsert({
      where: { id: configId },
      create: { id: configId, ip, port },
      update: { ip, port },
    });

    return NextResponse.json({
      role: target,
      config: serializeConfig(config),
    });
  } catch (error: unknown) {
    console.error("[admin/printers/PUT]", error);
    return NextResponse.json({ error: "Impossible de sauvegarder la configuration" }, { status: 500 });
  }
}
