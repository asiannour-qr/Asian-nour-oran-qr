// app/api/tables/[tableId]/cart/route.ts
import { NextResponse } from "next/server";
import { addItem, changeQty, clearCart, getCart, setPeopleCount, setTableComment, totalCents } from "../../../../../lib/cart";

export async function GET(_req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId manquant" }, { status: 400 });
    }
    const cart = getCart(tableId);
    return NextResponse.json({ ok: true, cart, total: totalCents(cart) });
  } catch (err: any) {
    console.error("[cart/GET] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la récupération du panier", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// POST: { id, name, price?, personId? }  -> ajoute 1
export async function POST(req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId manquant" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    if (!body.id || !body.name) {
      return NextResponse.json({ ok: false, error: "id et name requis" }, { status: 400 });
    }
    const cart = addItem(tableId, {
      id: String(body.id),
      name: String(body.name),
      price: typeof body.price === "number" ? body.price : undefined,
      personId: body.personId ? String(body.personId) : undefined,
      // on ignore ici body.comment pour éviter les notes par plat
    });
    return NextResponse.json({ ok: true, cart, total: totalCents(cart) });
  } catch (err: any) {
    console.error("[cart/POST] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de l'ajout au panier", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// PATCH: { peopleCount } OU { tableComment } OU { id, price?, personId?, delta }
export async function PATCH(req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId manquant" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));

    if (typeof body.peopleCount === "number") {
      const cart = setPeopleCount(tableId, body.peopleCount);
      return NextResponse.json({ ok: true, cart, total: totalCents(cart) });
    }

    if (typeof body.tableComment === "string") {
      const cart = setTableComment(tableId, body.tableComment);
      return NextResponse.json({ ok: true, cart, total: totalCents(cart) });
    }

    // ajustement quantité d'une ligne
    if (body.id && typeof body.delta === "number") {
      const cart = changeQty(tableId, {
        id: String(body.id),
        price: typeof body.price === "number" ? body.price : undefined,
        personId: body.personId ? String(body.personId) : undefined,
        delta: Number(body.delta),
      });
      return NextResponse.json({ ok: true, cart, total: totalCents(cart) });
    }

    return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
  } catch (err: any) {
    console.error("[cart/PATCH] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la mise à jour du panier", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// DELETE: vide le panier
export async function DELETE(_req: Request, { params }: { params: { tableId: string } }) {
  try {
    const tableId = String(params?.tableId ?? "").trim();
    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId manquant" }, { status: 400 });
    }
    const cart = clearCart(tableId);
    return NextResponse.json({ ok: true, cart, total: totalCents(cart) });
  } catch (err: any) {
    console.error("[cart/DELETE] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la suppression du panier", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}