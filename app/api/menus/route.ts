// app/api/menus/route.ts
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

const ORDER_BY = [{ position: "asc" as const }, { name: "asc" as const }];
const GROUP_ORDER = { orderBy: { position: "asc" as const } };
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toInt(value: unknown, fallback: number, opts?: { min?: number; max?: number }) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  if (opts?.min != null && rounded < opts.min) return opts.min;
  if (opts?.max != null && rounded > opts.max) return opts.max;
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

      const minChoices = toInt(minRaw, 1, { min: 0 });
      const maxChoices = toInt(maxRaw, minChoices, { min: minChoices });
      const position = toInt(raw?.position, index + 1, { min: 1 });

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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const isAdminView = url.searchParams.has("admin") || url.searchParams.get("all") === "1";
    const query = String(url.searchParams.get("query") ?? "").trim();
    const withGroups = url.searchParams.get("withGroups") !== "0";
    const composedOnly = url.searchParams.get("composed") === "1";

    const limit = isAdminView
      ? toInt(url.searchParams.get("limit"), DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT })
      : undefined;
    const offset = isAdminView ? Math.max(0, toInt(url.searchParams.get("offset"), 0, { min: 0 })) : 0;

    const where: Record<string, unknown> = {};
    if (!isAdminView) {
      where.active = true;
    }
    if (query) {
      where.name = { contains: query, mode: "insensitive" as const };
    }
    if (composedOnly) {
      where.groups = { some: {} };
    }

    const findArgs: any = {
      where,
      orderBy: ORDER_BY,
    };

    if (isAdminView && limit !== undefined) {
      findArgs.take = limit;
      findArgs.skip = offset;
    }

    if (withGroups || !isAdminView) {
      findArgs.include = { groups: GROUP_ORDER };
    }

    const menus = await prisma.menu.findMany(findArgs);
    const total = isAdminView ? await prisma.menu.count({ where }) : undefined;

    const response: Record<string, unknown> = { menus };
    if (isAdminView && total !== undefined) {
      response.meta = {
        total,
        limit: limit ?? menus.length,
        offset,
        count: menus.length,
        hasNext: offset + menus.length < total,
      };
    }

    return NextResponse.json(response);
  } catch (e: any) {
    console.error("[menus/GET] Prisma error:", e);
    return NextResponse.json(
      { menus: [], error: "Erreur lors de la récupération des menus", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));

    if (body?.fromId) {
      const source = await prisma.menu.findUnique({
        where: { id: String(body.fromId) },
        include: { groups: GROUP_ORDER },
      });
      if (!source) {
        return NextResponse.json({ status: "error", message: "Menu source introuvable" }, { status: 404 });
      }

      const duplicatedName =
        typeof body?.name === "string" ? body.name.trim() : `Copie de ${source.name}`.trim();
      const name = duplicatedName || `Copie de ${source.name}`;
      const priceCents = sanitizePriceCents(body) ?? source.priceCents ?? 0;
      const position = toInt(body?.position, source.position + 1);
      const active = body?.active != null ? Boolean(body.active) : false;

      const created = await prisma.menu.create({
        data: {
          name,
          priceCents,
          active,
          position,
          imageUrl: source.imageUrl,
          groups: source.groups.length
            ? {
                create: source.groups.map((g) => ({
                  name: g.name,
                  categoryFilter: g.categoryFilter,
                  minChoices: g.minChoices,
                  maxChoices: g.maxChoices,
                  position: g.position,
                })),
              }
            : undefined,
        },
        include: { groups: GROUP_ORDER },
      });

      return NextResponse.json({ status: "ok", menu: created }, { status: 201 });
    }

    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ status: "error", message: "name requis" }, { status: 400 });
    }

    const priceCents = sanitizePriceCents(body);
    if (priceCents == null) {
      return NextResponse.json({ status: "error", message: "price ou priceCents requis" }, { status: 400 });
    }

    const groupsData = normalizeGroupsInput(body?.groups) ?? [];

    const created = await prisma.menu.create({
      data: {
        name,
        priceCents,
        active: body?.active != null ? Boolean(body.active) : true,
        position: toInt(body?.position, 0),
        imageUrl:
          typeof body?.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null,
        groups: groupsData.length
          ? {
              create: groupsData.map((g) => ({
                name: g.name,
                categoryFilter: g.categoryFilter,
                minChoices: g.minChoices,
                maxChoices: g.maxChoices,
                position: g.position,
              })),
            }
          : undefined,
      },
      include: { groups: GROUP_ORDER },
    });

    return NextResponse.json({ status: "ok", menu: created }, { status: 201 });
  } catch (e: any) {
    console.error("[menus/POST] error:", e);
    return NextResponse.json(
      { status: "error", message: "Erreur lors de la création du menu", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
