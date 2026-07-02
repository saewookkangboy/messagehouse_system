import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/api";
import { requireAuth } from "@/lib/auth/session";
import { isAuthEnabled } from "@/lib/auth/types";
import { integrationsConfigured, listConnections } from "@/lib/integrations";

export async function GET() {
  try {
    const configured = integrationsConfigured();
    if (!isAuthEnabled()) {
      return NextResponse.json({
        authRequired: true,
        configured,
        connections: [],
      });
    }
    const auth = await requireAuth("viewer");
    if (!auth) {
      return NextResponse.json({ authRequired: true, configured, connections: [] });
    }
    const connections = await listConnections(auth.user.id);
    return NextResponse.json({ authRequired: false, configured, connections });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    throw err;
  }
}
