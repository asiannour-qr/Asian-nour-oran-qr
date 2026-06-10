import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAgentToken } from "@/lib/print-agent-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const unauthorized = assertAgentToken(req);
  if (unauthorized) return unauthorized;

  const id = params.id?.trim();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  let body: { ok?: unknown; error?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const job = await prisma.printJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Job introuvable" }, { status: 404 });

  if (body.ok === true) {
    await prisma.printJob.update({
      where: { id },
      data: { status: "DONE", printedAt: new Date(), lastError: null },
    });
    return NextResponse.json({ ok: true });
  }

  const attempts = job.attempts + 1;
  await prisma.printJob.update({
    where: { id },
    data: {
      attempts,
      lastError: typeof body.error === "string" ? body.error.slice(0, 500) : "Erreur inconnue",
      status: attempts >= MAX_ATTEMPTS ? "ERROR" : "PENDING",
    },
  });
  return NextResponse.json({ ok: true, attempts });
}
