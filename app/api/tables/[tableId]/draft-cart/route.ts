import { NextResponse } from "next/server";
import {
  clearTableDraftCart,
  getTableDraftCart,
  saveTableDraftCart,
  type DraftCartItem,
} from "@/lib/table-draft-cart";
import { getTableMaster, isMasterDevice } from "@/lib/table-master";
import { isStaffDeviceId } from "@/lib/staff-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readDeviceId(body?: { deviceId?: unknown }): string {
  const fromBody = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  return fromBody.length >= 8 ? fromBody : "";
}

function draftResponse(draft: Awaited<ReturnType<typeof getTableDraftCart>>) {
  if (!draft) {
    return NextResponse.json({
      ok: true,
      draft: null,
      itemCount: 0,
    });
  }
  const itemCount = draft.items.reduce((sum, line) => sum + line.qty, 0);
  return NextResponse.json({
    ok: true,
    draft: {
      items: draft.items,
      peopleCount: draft.peopleCount,
      tableComment: draft.tableComment,
      guestNames: draft.guestNames,
      updatedAt: draft.updatedAt.toISOString(),
    },
    itemCount,
  });
}

export async function GET(_req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, message: "tableId manquant" }, { status: 400 });
    }
    const draft = await getTableDraftCart(tableId);
    return draftResponse(draft);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[draft-cart/GET]", message);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, message: "tableId manquant" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const deviceId = readDeviceId(body);
    if (!deviceId) {
      return NextResponse.json({ ok: false, message: "deviceId requis" }, { status: 400 });
    }

    const master = await getTableMaster(tableId);
    const items = Array.isArray(body.items) ? (body.items as DraftCartItem[]) : [];
    const isMaster = isMasterDevice(master, deviceId);

    if (!isMaster) {
      const clientCatchUp =
        items.length > 0 &&
        !isStaffDeviceId(deviceId) &&
        master &&
        isStaffDeviceId(master.deviceId);
      if (!clientCatchUp) {
        return NextResponse.json(
          { ok: false, message: "Seul le téléphone maître peut enregistrer le panier." },
          { status: 403 }
        );
      }
    }

    const peopleCount =
      typeof body.peopleCount === "number" ? body.peopleCount : Number(body.peopleCount);
    const tableComment =
      body.tableComment === null || typeof body.tableComment === "string"
        ? body.tableComment
        : undefined;
    const guestNames =
      body.guestNames && typeof body.guestNames === "object" && !Array.isArray(body.guestNames)
        ? (body.guestNames as Record<string, string>)
        : undefined;

    const draft = await saveTableDraftCart(tableId, {
      items,
      peopleCount: Number.isFinite(peopleCount) ? peopleCount : undefined,
      tableComment,
      guestNames,
      allowEmpty: body?.allowEmpty === true,
    });

    const itemCount = draft.items.reduce((sum, line) => sum + line.qty, 0);
    return NextResponse.json({
      ok: true,
      itemCount,
      updatedAt: draft.updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[draft-cart/PUT]", message);
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
    const deviceId = readDeviceId(body);
    if (deviceId) {
      const master = await getTableMaster(tableId);
      if (master && !isMasterDevice(master, deviceId)) {
        return NextResponse.json(
          { ok: false, message: "Seul le téléphone maître peut vider le brouillon." },
          { status: 403 }
        );
      }
    }

    await clearTableDraftCart(tableId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[draft-cart/DELETE]", message);
    return NextResponse.json({ ok: false, message: "Erreur serveur" }, { status: 500 });
  }
}
