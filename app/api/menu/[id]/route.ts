// app/api/menu/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const unauthorized = assertAdminSession();
    if (unauthorized) return unauthorized;
    try {
        const id = params?.id;
        if (!id) {
            return NextResponse.json({ status: "error", message: "id manquant" }, { status: 400 });
        }

        const body = await req.json();
        const data: Record<string, unknown> = {};

        if (body.name != null) data.name = String(body.name).trim();
        if (body.category != null) data.category = String(body.category).trim();
        if (body.description != null) data.description = body.description ? String(body.description) : null;
        if (body.imageUrl != null) data.imageUrl = body.imageUrl ? String(body.imageUrl) : null;
        if (body.available != null) {
            data.available = Boolean(body.available);
            if (data.available === true) {
                data.hideWhenUnavailable = false;
            }
        }
        if (body.hideWhenUnavailable != null) {
            data.hideWhenUnavailable = Boolean(body.hideWhenUnavailable);
        }
        if (body.position != null && Number.isFinite(Number(body.position))) {
            data.position = Number(body.position);
        }
        if (body.spicyLevel != null && Number.isFinite(Number(body.spicyLevel))) {
            data.spicyLevel = Number(body.spicyLevel);
        }

        if (body.priceCents != null && Number.isFinite(Number(body.priceCents))) {
            data.priceCents = Math.max(0, Math.round(Number(body.priceCents)));
        } else if (body.price != null) {
            const asNumber = Number(String(body.price).replace(",", "."));
            if (Number.isFinite(asNumber)) {
                data.priceCents = Math.max(0, Math.round(asNumber * 100));
            }
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ status: "error", message: "aucune donnée valide pour la mise à jour" }, { status: 400 });
        }

        const updated = await prisma.menuItem.update({
            where: { id },
            data,
        });

        return NextResponse.json({ status: "ok", item: updated });
    } catch (e: any) {
        return NextResponse.json({ status: "error", message: e.message }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const unauthorized = assertAdminSession();
    if (unauthorized) return unauthorized;
    try {
        const id = params?.id;
        if (!id) {
            return NextResponse.json({ status: "error", message: "id manquant" }, { status: 400 });
        }

        await prisma.menuItem.delete({ where: { id } });
        return NextResponse.json({ status: "ok" });
    } catch (e: any) {
        return NextResponse.json({ status: "error", message: e.message }, { status: 500 });
    }
}
