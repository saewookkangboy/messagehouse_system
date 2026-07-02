import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { newSessionToken, sessionExpiry, SESSION_COOKIE } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않아요." }, { status: 401 });
  }

  const token = newSessionToken();
  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: sessionExpiry(),
    },
  });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: sessionExpiry(),
  });
  return response;
}
