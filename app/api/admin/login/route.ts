import { NextResponse } from "next/server";

const EIGHT_HOURS = 8 * 60 * 60;

type Credentials = {
  user?: string;
  pass?: string;
};

function getExpectedCredentials() {
  const user = process.env.ADMIN_USER || "asian";
  const pass = process.env.ADMIN_PASS || "nour123!";
  return { user, pass };
}

export async function POST(request: Request) {
  let body: Credentials;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { user, pass } = getExpectedCredentials();
  if (!body || body.user !== user || body.pass !== pass) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: "admin",
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    maxAge: EIGHT_HOURS,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
