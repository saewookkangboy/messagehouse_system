import type { EmailProvider, SendEmailInput, SendEmailResult } from "./schema";

/**
 * Logs the email instead of sending it. Lets invite creation work with zero
 * network calls and zero API key — the invite link still shows in the UI
 * as a copy-paste fallback either way. Swapped for ResendEmailProvider once
 * RESEND_API_KEY is set (see lib/email/index.ts).
 */
export class StubEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    console.log(`[StubEmailProvider] ${input.to} <- "${input.subject}"\n${input.text}`);
    return { sent: false, provider: "stub" };
  }
}
