/** Best-effort client IP for rate-limiting keys. Trusts proxy headers as-is,
 * which is fine behind a single trusted reverse proxy (Vercel, etc.) but not
 * a hardened anti-spoofing measure. */
export function requestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
