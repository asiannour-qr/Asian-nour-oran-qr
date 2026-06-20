import { NextResponse } from "next/server";

/** API panier legacy (mémoire process) — retirée au profit de draft-cart. */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "API retirée. Utilisez /api/tables/[tableId]/draft-cart",
      deprecated: true,
    },
    { status: 410 }
  );
}

export async function POST() {
  return GET();
}

export async function PATCH() {
  return GET();
}

export async function DELETE() {
  return GET();
}
