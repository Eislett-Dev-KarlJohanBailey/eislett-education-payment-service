import { randomUUID } from "crypto";
import { sendMail } from "../infrastructure/email.client";
import { getNoReplySecret, getJwtEmailSecret } from "../infrastructure/secrets.client";
import { signUnsubscribeToken } from "../infrastructure/jwt-email";
import { TemplateService } from "../infrastructure/template.service";
import type { EmailQueueMessage, NoReplySecret } from "../types";
import { EmailsSentRepository } from "../infrastructure/dynamodb.client";
import { UnsubscribesRepository } from "../infrastructure/dynamodb.client";

export class SendEmailUseCase {
  constructor(
    private readonly templateService: TemplateService,
    private readonly emailsSentRepo: EmailsSentRepository,
    private readonly unsubscribesRepo: UnsubscribesRepository,
    private readonly noReplySecretName: string,
    private readonly jwtEmailSecretName: string | undefined,
    private readonly unsubscribeBaseUrl: string | undefined
  ) {}

  async execute(
    message: EmailQueueMessage,
    _messageId: string
  ): Promise<{ success: boolean; error?: string }> {
    const to = message.to?.trim();
    if (!to) {
      return { success: false, error: "Missing 'to'" };
    }

    const isUnsubscribed = await this.unsubscribesRepo.isUnsubscribed(to);
    if (isUnsubscribed) {
      console.log(`Skipping email to unsubscribed address: ${to}`);
      return { success: true };
    }

    let secret: NoReplySecret;
    try {
      secret = await getNoReplySecret(this.noReplySecretName);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return { success: false, error: `Secrets: ${err}` };
    }

    const fromAddress = secret.from ?? secret.user;

    let content = message.content ?? {};
    if (
      this.jwtEmailSecretName &&
      this.unsubscribeBaseUrl &&
      content.unsubscribeUrl == null
    ) {
      try {
        const jwtSecret = await getJwtEmailSecret(this.jwtEmailSecretName);
        const token = signUnsubscribeToken(to, jwtSecret);
        content = { ...content, unsubscribeUrl: `${this.unsubscribeBaseUrl}?token=${encodeURIComponent(token)}` };
      } catch (e) {
        console.warn("Could not build unsubscribe URL:", e);
      }
    }

    let html: string | undefined;
    const text = !message.template && typeof content?.message === "string"
      ? (content as { message: string }).message
      : undefined;

    if (message.template) {
      try {
        html = await this.templateService.render(message.template, content as Record<string, unknown>);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        return { success: false, error: `Template: ${err}` };
      }
    } else if (typeof (content as { message?: string }).message === "string") {
      html = (content as { message: string }).message;
    } else {
      return { success: false, error: "Missing template or content.message" };
    }

    try {
      await sendMail(secret, {
        from: fromAddress,
        to,
        subject: message.header ?? "(No subject)",
        html: html || undefined,
        text: text || html,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return { success: false, error: `Send: ${err}` };
    }

    const recordId = randomUUID();
    await this.emailsSentRepo.record({
      id: recordId,
      to,
      template: message.template ?? undefined,
      header: message.header ?? "",
      sentAt: new Date().toISOString(),
    });

    return { success: true };
  }
}
