// app/api/menus/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdminSession } from "@/lib/admin-session";

type RawGroup = {
  id?: string;
  name?: string;
  label?: string;
  categoryFilter?: string;
  filter?: string;
  categories?: string[] | string;
  minChoices?: number;
  maxChoices?: number;
  min?: number;
  max?: number;
  position?: number;
};

type NormalizedGroup = {
  name: string;
  categoryFilter: string;
  minChoices: number;
  maxChoices: number;
  position: number;
};

const GROUP_ORDER = { orderBy: { position: "asc" as const } };

function sanitizeNumber(value: unknown, fallback: number, opts?: { min?: number }) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  if (opts?.min != null) {
    return Math.max(opts.min, rounded);
  }
  return rounded;
}

function sanitizePriceCents(body: any): number | null {
  if (body?.priceCents != null && Number.isFinite(Number(body.priceCents))) {
    return Math.max(0, Math.round(Number(body.priceCents)));
  }
  if (body?.price != null) {
    const parsed = Number(String(body.price).replace(",", "."));
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed * 100));
    }
  }
  return null;
}

function normalizeGroupsInput(list: unknown): NormalizedGroup[] | null {
  if (!Array.isArray(list)) return null;
  return list
    .map((raw: RawGroup, index) => {
      const baseName = raw?.name ?? raw?.label ?? `Groupe ${index + 1}`;
      const name = String(baseName ?? "").trim() || `Groupe ${index + 1}`;

      let categoryFilter = "";
      if (typeof raw?.categoryFilter === "string" && raw.categoryFilter.trim()) {
        categoryFilter = raw.categoryFilter.trim();
      } else if (typeof raw?.filter === "string" && raw.filter.trim()) {
        categoryFilter = raw.filter.trim();
      } else if (Array.isArray(raw?.categories) && raw.categories.length > 0) {
        categoryFilter = raw.categories
          .map((cat) => (typeof cat === "string" ? cat.trim() : ""))
          .filter(Boolean)
          .join(" | ");
      } else if (typeof raw?.categories === "string" && raw.categories.trim()) {
        categoryFilter = raw.categories
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean)
          .join(" | ");
      }

      if (!categoryFilter) {
        categoryFilter = name;
      }

      const minRaw = raw?.minChoices ?? raw?.min;
      const maxRaw = raw?.maxChoices ?? raw?.max;

      let minChoices = sanitizeNumber(minRaw, 1, { min: 0 });
      let maxChoices = sanitizeNumber(maxRaw, minChoices, { min: minChoices });

      const position = sanitizeNumber(raw?.position, index + 1, { min: 1 });

      if (maxChoices < minChoices) {
        maxChoices = minChoices;
      }

      return {
        name,
        categoryFilter,
        minChoices,
        maxChoices,
        position,
      };
    })
    .filter(Boolean);
}

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
    if (body.active != null) data.active = Boolean(body.active);
    if (body.position != null) {
      data.position = sanitizeNumber(body.position, 0);
    }

    const priceCents = sanitizePriceCents(body);
    if (priceCents != null) {
      data.priceCents = priceCents;
    }

    const normalizedGroups = normalizeGroupsInput(body?.groups);
    if (!Object.keys(data).length && normalizedGroups === null) {
      return NextResponse.json(
        { status: "error", message: "aucune donnée valide pour la mise à jour" },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.menu.update({
          where: { id },
          data,
        });
      }

      if (normalizedGroups) {
        await tx.menuGroup.deleteMany({ where: { menuId: id } });
        if (normalizedGroups.length > 0) {
          await tx.menuGroup.createMany({
            data: normalizedGroups.map((g) => ({
              menuId: id,
              name: g.name,
              categoryFilter: g.categoryFilter,
              minChoices: g.minChoices,
              maxChoices: Math.max(g.minChoices, g.maxChoices),
              position: g.position,
            })),
          });
        }
      }

      return tx.menu.findUnique({
        where: { id },
        include: { groups: GROUP_ORDER },
      });
    });

    return NextResponse.json({ status: "ok", menu: updated });
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

    await prisma.menu.delete({ where: { id } });
    return NextResponse.json({ status: "ok" });
  } catch (e: any) {
    return NextResponse.json({ status: "error", message: e.message }, { status: 500 });
  }
}
