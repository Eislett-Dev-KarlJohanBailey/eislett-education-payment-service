import type { RequestContext } from "../handler/api-gateway/types";
import type { UnsubscribesRepository } from "../infrastructure/dynamodb.client";
import { getJwtEmailSecret } from "../infrastructure/secrets.client";
import { verifyUnsubscribeToken } from "../infrastructure/jwt-email";

export class UnsubscribeController {
  constructor(
    private readonly unsubscribesRepo: UnsubscribesRepository,
    private readonly jwtEmailSecretName: string
  ) {}

  async handle(req: RequestContext): Promise<{ ok: boolean; message: string }> {
    const token =
      (req.method === "GET"
        ? req.query?.token ?? req.query?.t
        : (req.body ?? {})?.token ?? (req.body ?? {})?.t) as string | undefined;

    if (!token?.trim()) {
      return {
        ok: false,
        message: "Missing token (query param 'token' or body.token required)",
      };
    }

    let secret: string;
    try {
      secret = await getJwtEmailSecret(this.jwtEmailSecretName);
    } catch (e) {
      console.error("Failed to load JWT email secret:", e);
      return { ok: false, message: "Service configuration error" };
    }

    let email: string;
    try {
      email = verifyUnsubscribeToken(token.trim(), secret);
    } catch (e) {
      return { ok: false, message: "Invalid or expired unsubscribe link" };
    }

    await this.unsubscribesRepo.unsubscribe(email);
    return { ok: true, message: "You have been unsubscribed." };
  }
}
