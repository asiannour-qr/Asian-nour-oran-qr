import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin-session";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

async function uploadImage(file: Blob, menuId: string): Promise<string> {
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `composed-menu-${menuId}-${Date.now()}.${ext}`;

  // Use Vercel Blob when token is available (production)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`menu/${filename}`, file, {
      access: "public",
      addRandomSuffix: false,
    });
    return blob.url;
  }

  // Fallback: local filesystem (development)
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  const menuId = params.id?.trim();
  if (!menuId) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const menu = await prisma.menu.findUnique({ where: { id: menuId } });
  if (!menu) return NextResponse.json({ error: "Menu introuvable" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData invalide" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté (JPG, PNG, WebP uniquement)" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (4 Mo max)" },
      { status: 400 }
    );
  }

  try {
    const imageUrl = await uploadImage(file, menuId);
    const updated = await prisma.menu.update({
      where: { id: menuId },
      data: { imageUrl },
    });
    return NextResponse.json({ imageUrl: updated.imageUrl });
  } catch (err) {
    console.error("[menus/image/upload]", err);
    return NextResponse.json(
      { error: "Erreur lors de l'upload" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  const menuId = params.id?.trim();
  if (!menuId) return NextResponse.json({ error: "id requis" }, { status: 400 });

  await prisma.menu.update({
    where: { id: menuId },
    data: { imageUrl: null },
  });

  return NextResponse.json({ ok: true });
}
