const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Lightweight CSRF defense for JSON APIs: state-changing requests must carry
 * an Origin (or, failing that, Referer) header that matches this app's own
 * origin. Requests with neither header are allowed through — browsers always
 * send at least one on cross-site requests, so their absence means either a
 * same-origin request or a non-browser client, not a forged cross-site one.
 */
export function isSameOrigin(input: {
  method: string;
  originHeader: string | null;
  refererHeader: string | null;
  requestOrigin: string;
}): boolean {
  if (SAFE_METHODS.has(input.method)) return true;

  if (input.originHeader) {
    return input.originHeader === input.requestOrigin;
  }

  if (input.refererHeader) {
    try {
      return new URL(input.refererHeader).origin === input.requestOrigin;
    } catch {
      return false;
    }
  }

  return true;
}
