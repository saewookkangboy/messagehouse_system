import { NextResponse } from "next/server";
import { AuthError, assertPackTeamAccess, requireAuth } from "./session";
import type { TeamRole } from "@/generated/prisma/client";
import type { AuthContext } from "./types";

export function authErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode });
  }
  return null;
}

export async function authorizePack(
  packId: string,
  minRole: TeamRole = "viewer",
): Promise<AuthContext | null> {
  const auth = await requireAuth(minRole);
  await assertPackTeamAccess(packId, auth);
  return auth;
}
