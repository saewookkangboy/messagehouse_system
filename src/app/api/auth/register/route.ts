import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  newSessionToken,
  sessionExpiry,
  SESSION_COOKIE,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { requestIp } from "@/lib/requestIp";

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(128),
  teamName: z.string().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const { allowed, retryAfterMs } = await checkRateLimit(`register:${requestIp(request)}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "가입 시도가 너무 많아요. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  const parsed = RegisterSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력 형식이 올바르지 않아요.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, name, password, teamName } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "이미 사용 중인 이메일이에요." }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name: name.trim(),
      passwordHash: hashPassword(password),
    },
  });

  const team = await db.team.create({
    data: {
      name: teamName?.trim() || `${name.trim()} 팀`,
      members: {
        create: { userId: user.id, role: "owner" },
      },
    },
  });

  const token = newSessionToken();
  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: sessionExpiry(),
    },
  });

  const response = NextResponse.json(
    {
      user: { id: user.id, email: user.email, name: user.name },
      team: { id: team.id, name: team.name },
    },
    { status: 201 },
  );
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: sessionExpiry(),
  });
  return response;
}
