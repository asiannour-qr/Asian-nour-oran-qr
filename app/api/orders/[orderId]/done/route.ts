import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";

export async function POST(
    _req: Request,
    { params }: { params: { orderId: string } }
) {
    try {
        const orderId = String(params?.orderId ?? "").trim();
        if (!orderId) {
            return NextResponse.json({ ok: false, error: "orderId manquant" }, { status: 400 });
        }
        const updated = await prisma.order.update({
            where: { id: orderId },
            data: { status: "DONE" },
        });
        return NextResponse.json({ ok: true, order: updated });
    } catch (err: any) {
        const errorMessage = err?.message ?? String(err);
        const isLocked = errorMessage.includes("database is locked") || errorMessage.includes("SQLITE_BUSY");
        console.error("[orders/[orderId]/done/POST] error:", {
            message: errorMessage,
            code: err?.code,
            meta: err?.meta,
            stack: err?.stack,
            orderId: params?.orderId,
        });
        return NextResponse.json(
            {
                ok: false,
                error: isLocked
                    ? "Base de données temporairement verrouillée, réessayez dans quelques instants"
                    : "Erreur lors de la mise à jour du statut",
                details: errorMessage,
                code: err?.code,
            },
            { status: isLocked ? 503 : 500 }
        );
    }
}