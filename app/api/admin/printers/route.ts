import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";
import {
  DEFAULT_PRINTER_PORT,
  normalizePrinterIp,
  parsePrinterPort,
  PRINTER_CONFIG_ID,
} from "@/lib/printer-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  try {
    const config = await prisma.printerConfig.findUnique({
      where: { id: PRINTER_CONFIG_ID },
    });

    return NextResponse.json({
      config: config
        ? { ip: config.ip, port: config.port, updatedAt: config.updatedAt.toISOString() }
        : null,
      defaults: { port: DEFAULT_PRINTER_PORT },
    });
  } catch (error: unknown) {
    console.error("[admin/printers/GET]", error);
    return NextResponse.json({ error: "Impossible de charger la configuration" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  let body: { ip?: unknown; port?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const ip = normalizePrinterIp(body.ip);
  if (!ip) {
    return NextResponse.json({ error: "Adresse IP invalide (format IPv4 attendu)" }, { status: 400 });
  }

  const port = parsePrinterPort(body.port ?? DEFAULT_PRINTER_PORT);
  if (port === null) {
    return NextResponse.json({ error: "Port invalide (1–65535)" }, { status: 400 });
  }

  try {
    const config = await prisma.printerConfig.upsert({
      where: { id: PRINTER_CONFIG_ID },
      create: { id: PRINTER_CONFIG_ID, ip, port },
      update: { ip, port },
    });

    return NextResponse.json({
      config: {
        ip: config.ip,
        port: config.port,
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("[admin/printers/PUT]", error);
    return NextResponse.json({ error: "Impossible de sauvegarder la configuration" }, { status: 500 });
  }
}
