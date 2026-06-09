// app/api/menu/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";

export async function GET() {
    try {
        const items = await prisma.menuItem.findMany({
            orderBy: [{ position: "asc" }, { category: "asc" }, { name: "asc" }],
        });
        return NextResponse.json({ items });
    } catch (e: any) {
        console.error("[menu/GET] Prisma error:", e);
        return NextResponse.json(
            { items: [], error: "Erreur lors de la récupération du menu", details: String(e?.message ?? e) },
            { status: 500 }
        );
    }
}

// (optionnel) création rapide pour l'admin
export async function POST(req: Request) {
    const unauthorized = assertAdminSession();
    if (unauthorized) return unauthorized;
    try {
        const body = await req.json().catch(() => ({}));
        const name = String(body?.name || "").trim();
        const category = String(body?.category || "").trim();
        if (!name || !category) {
            return NextResponse.json({ status: "error", message: "name et category requis" }, { status: 400 });
        }
        let priceCents = Number(body?.priceCents ?? NaN);
        if (!Number.isFinite(priceCents) && body?.price != null) {
            const asNumber = Number(String(body.price).replace(",", "."));
            priceCents = Number.isFinite(asNumber) ? Math.round(asNumber * 100) : 0;
        }
        if (!Number.isFinite(priceCents)) priceCents = 0;
        priceCents = Math.max(0, Math.round(priceCents));
        const created = await prisma.menuItem.create({
            data: {
                name,
                category,
                priceCents,
                available: body?.available != null ? Boolean(body.available) : true,
                position: Number(body?.position ?? 0),
                description: body?.description ? String(body.description) : null,
                imageUrl: body?.imageUrl ? String(body.imageUrl) : null,
                spicyLevel: body?.spicyLevel != null ? Number(body.spicyLevel) : null,
            },
        });
        return NextResponse.json({ status: "ok", item: created }, { status: 201 });
    } catch (e: any) {
        console.error("[menu/POST] error:", e);
        return NextResponse.json(
            { status: "error", message: "Erreur lors de la création du plat", details: String(e?.message ?? e) },
            { status: 500 }
        );
    }
}
