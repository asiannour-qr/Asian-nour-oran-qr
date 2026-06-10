import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin-session";
import prisma from "@/lib/prisma";
import { SETTINGS_ID } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 Mo — carte pleine page

async function uploadMenuCardImage(file: Blob): Promise<string> {
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `menu-card-${Date.now()}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`menu-card/${filename}`, file, {
      access: "public",
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}

export async function POST(req: Request) {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

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
    return NextResponse.json({ error: "Fichier trop volumineux (8 Mo max)" }, { status: 400 });
  }

  try {
    const menuCardImageUrl = await uploadMenuCardImage(file);
    await prisma.restaurantSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, menuCardImageUrl },
      update: { menuCardImageUrl },
    });
    return NextResponse.json({ menuCardImageUrl });
  } catch (err) {
    console.error("[admin/settings/menu-card/upload]", err);
    return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
  }
}

export async function DELETE() {
  const unauthorized = assertAdminSession();
  if (unauthorized) return unauthorized;

  await prisma.restaurantSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, menuCardImageUrl: null },
    update: { menuCardImageUrl: null },
  });

  return NextResponse.json({ ok: true });
}
