import { NextResponse } from "next/server";
import { getSession, listUserTeams } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session.enabled) {
    return NextResponse.json({ authenticated: false, authDisabled: true });
  }
  if (!session.authenticated) {
    return NextResponse.json({ authenticated: false });
  }
  const teams = await listUserTeams(session.user.id);
  return NextResponse.json({
    authenticated: true,
    user: session.user,
    team: { id: session.teamId, name: session.teamName },
    role: session.role,
    teams,
  });
}
