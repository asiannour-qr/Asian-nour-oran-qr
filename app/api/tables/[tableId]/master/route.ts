import { NextResponse } from "next/server";
import {
  claimTableMaster,
  forceClaimTableMaster,
  getTableMaster,
  isMasterDevice,
  releaseTableMaster,
  touchTableMaster,
} from "@/lib/table-master";
import { assertStaffSession, isStaffDeviceId } from "@/lib/staff-session";
import { getTableDraftCart } from "@/lib/table-draft-cart";

function readDeviceId(req: Request, body?: { deviceId?: unknown }): string {
  const fromBody = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  if (fromBody.length >= 8) return fromBody;
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("deviceId")?.trim() ?? "";
  return fromQuery.length >= 8 ? fromQuery : "";
}

function serializeDraft(draft: Awaited<ReturnType<typeof getTableDraftCart>>) {
  if (!draft) return null;
  return {
    items: draft.items,
    peopleCount: draft.peopleCount,
    tableComment: draft.tableComment,
    guestNames: draft.guestNames,
    updatedAt: draft.updatedAt.toISOString(),
    itemCount: draft.items.reduce((sum, line) => sum + line.qty, 0),
  };
}

export async function GET(req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, message: "tableId manquant" }, { status: 400 });
    }

    const deviceId = readDeviceId(req);
    const master = await getTableMaster(tableId);

    return NextResponse.json({
      ok: true,
      hasMaster: Boolean(master),
      isMaster: isMasterDevice(master, deviceId),
      claimedAt: master?.claimedAt?.toISOString() ?? null,
      expiresAt: master?.expiresAt?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[master/GET]", message);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, message: "tableId manquant" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const deviceId = readDeviceId(req, body);
    if (!deviceId) {
      return NextResponse.json({ ok: false, message: "deviceId requis" }, { status: 400 });
    }

    const force = body?.force === true;
    if (force) {
      const unauthorized = assertStaffSession();
      if (unauthorized) return unauthorized;
      if (!isStaffDeviceId(deviceId)) {
        return NextResponse.json(
          { ok: false, message: "Prise forcée réservée au mode serveur." },
          { status: 400 }
        );
      }
      const record = await forceClaimTableMaster(tableId, deviceId);
      const draft = await getTableDraftCart(tableId);
      return NextResponse.json({
        ok: true,
        isMaster: true,
        hasMaster: true,
        forced: true,
        claimedAt: record.claimedAt.toISOString(),
        expiresAt: record.expiresAt.toISOString(),
        draft: serializeDraft(draft),
      });
    }

    const result = await claimTableMaster(tableId, deviceId);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "TAKEN",
          message: "Un autre téléphone gère déjà la commande pour cette table.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      isMaster: true,
      hasMaster: true,
      claimedAt: result.record.claimedAt.toISOString(),
      expiresAt: result.record.expiresAt.toISOString(),
      draft: serializeDraft(await getTableDraftCart(tableId)),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[master/POST]", message);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, message: "tableId manquant" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const deviceId = readDeviceId(req, body);
    if (!deviceId) {
      return NextResponse.json({ ok: false, message: "deviceId requis" }, { status: 400 });
    }

    const released = await releaseTableMaster(tableId, deviceId);
    if (!released) {
      return NextResponse.json(
        { ok: false, message: "Impossible de libérer la commande (pas le téléphone maître)." },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true, hasMaster: false, isMaster: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[master/DELETE]", message);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/** Prolonge le verrou maître (appelé à l'envoi de commande). */
export async function PATCH(req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, message: "tableId manquant" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const deviceId = readDeviceId(req, body);
    if (!deviceId) {
      return NextResponse.json({ ok: false, message: "deviceId requis" }, { status: 400 });
    }

    const ok = await touchTableMaster(tableId, deviceId);
    if (!ok) {
      return NextResponse.json({ ok: false, message: "Pas le téléphone maître." }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[master/PATCH]", message);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}
