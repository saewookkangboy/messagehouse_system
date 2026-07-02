import type { EmailProvider, SendEmailInput, SendEmailResult } from "./schema";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Real email delivery via the Resend API. Not runtime-verified in this
 * environment (no RESEND_API_KEY available) — same caveat as
 * ClaudeAiProvider/TavilyResearchProvider before their first live call.
 * EMAIL_FROM must be a domain verified in the Resend dashboard in
 * production; defaults to Resend's shared sandbox sender for local testing.
 */
export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private from: string;

  constructor(
    apiKey = process.env.RESEND_API_KEY,
    from = process.env.EMAIL_FROM || "MessageHouse <onboarding@resend.dev>",
  ) {
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY가 설정되지 않았어요. .env에 키를 추가하거나 EMAIL_PROVIDER=stub으로 실행하세요.",
      );
    }
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`이메일 발송에 실패했어요 (${res.status}).`);
    }
    return { sent: true, provider: "resend" };
  }
}
