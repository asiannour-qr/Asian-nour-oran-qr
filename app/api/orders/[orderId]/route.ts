import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

const ALLOWED = new Set(["NEW", "IN_PROGRESS", "READY", "SERVED", "CANCELED"]);

// NOTE: fonctionne même si le dossier s'appelle [id] ou [orderId]
export async function PATCH(
    req: Request,
    ctx: { params: { id?: string; orderId?: string } }
) {
    try {
        const data = await req.json().catch(() => ({}));
        const status = String(data?.status ?? "").trim();
        if (!status) {
            return NextResponse.json(
                { status: "error", message: "Champ 'status' manquant" },
                { status: 400 }
            );
        }
        if (!ALLOWED.has(status)) {
            return NextResponse.json(
                { status: "error", message: `Status invalide: ${status}` },
                { status: 400 }
            );
        }

        const id = ctx.params.id ?? ctx.params.orderId; // ⬅️ clé du fix
        if (!id) {
            return NextResponse.json(
                { status: "error", message: "Paramètre d'URL 'id' manquant" },
                { status: 400 }
            );
        }

        const updated = await prisma.order.update({
            where: { id },
            data: { status },
            include: { items: true },
        });

        return NextResponse.json({ status: "ok", order: updated });
    } catch (err: any) {
        const errorMessage = err?.message ?? String(err);
        const isLocked = errorMessage.includes("database is locked") || errorMessage.includes("SQLITE_BUSY");
        console.error("[orders/[orderId]/PATCH] error:", {
            message: errorMessage,
            code: err?.code,
            meta: err?.meta,
            stack: err?.stack,
            orderId: ctx.params.id ?? ctx.params.orderId,
        });
        return NextResponse.json(
            {
                status: "error",
                message: isLocked
                    ? "Base de données temporairement verrouillée, réessayez dans quelques instants"
                    : err?.message || "Erreur serveur",
                details: errorMessage,
                code: err?.code,
            },
            { status: isLocked ? 503 : 500 }
        );
    }
}