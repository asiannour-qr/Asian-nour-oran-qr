import { NextResponse } from "next/server";

export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: "admin",
    value: "",
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
