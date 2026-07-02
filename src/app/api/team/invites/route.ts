import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildInviteEmail,
  createTeamInvite,
  InviteError,
  isInvitableRole,
  listTeamInvites,
  revokeTeamInvite,
} from "@/lib/auth/invite";
import { authErrorResponse } from "@/lib/auth/api";
import { requireAuth } from "@/lib/auth/session";
import { getEmailProvider } from "@/lib/email";

const CreateInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

export async function GET() {
  try {
    const auth = await requireAuth("admin");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }
    const invites = await listTeamInvites(auth.teamId);
    return NextResponse.json({
      invites: invites.map((inv) => ({
        ...inv,
        invitePath: `/invite/${inv.token}`,
      })),
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const parsed = CreateInviteSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "이메일과 역할을 확인해주세요." }, { status: 400 });
    }
    if (!isInvitableRole(parsed.data.role)) {
      return NextResponse.json({ error: "지원하지 않는 역할이에요." }, { status: 400 });
    }

    const invite = await createTeamInvite({
      teamId: auth.teamId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedById: auth.user.id,
    });

    const email = buildInviteEmail({
      teamName: auth.teamName,
      role: parsed.data.role,
      invitedByName: auth.user.name,
      inviteUrl: new URL(invite.invitePath, request.url).toString(),
    });
    let emailSent = false;
    try {
      const result = await getEmailProvider().send({
        to: parsed.data.email,
        subject: email.subject,
        text: email.text,
      });
      emailSent = result.sent;
    } catch {
      // 이메일 발송 실패는 초대 생성 자체를 막지 않아요 — 링크 복사로 여전히 초대할 수 있어요.
    }

    return NextResponse.json({ invite, emailSent }, { status: 201 });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    if (err instanceof InviteError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (!auth) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const url = new URL(request.url);
    const inviteId = url.searchParams.get("id");
    if (!inviteId) {
      return NextResponse.json({ error: "초대 ID가 필요해요." }, { status: 400 });
    }

    await revokeTeamInvite(inviteId, auth.teamId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    if (err instanceof InviteError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    throw err;
  }
}
