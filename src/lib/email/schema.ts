export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export interface SendEmailResult {
  sent: boolean;
  provider: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
