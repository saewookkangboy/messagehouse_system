import { randomBytes } from "node:crypto";
import type { TeamRole, User } from "@/generated/prisma/client";

export type { TeamRole };

export const SESSION_COOKIE = "mh_session";
const SESSION_DAYS = 14;

export type AuthContext = {
  user: Pick<User, "id" | "email" | "name">;
  teamId: string;
  teamName: string;
  role: TeamRole;
};

export type SessionUser =
  | { enabled: false }
  | ({ enabled: true; authenticated: true } & AuthContext)
  | { enabled: true; authenticated: false };

export function isAuthEnabled(): boolean {
  return process.env.AUTH_DISABLED !== "true";
}

export function sessionExpiry(): Date {
  const ms = SESSION_DAYS * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export const ROLE_RANK: Record<TeamRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function hasMinRole(role: TeamRole, min: TeamRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
