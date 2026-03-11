import jwt from "jsonwebtoken";

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface UnsubscribeTokenPayload {
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Create a JWT containing only the email, for use in unsubscribe links.
 * Caller must pass the secret (from JWT_EMAIL_SERVICE_SECRET_NAME).
 */
export function signUnsubscribeToken(
  email: string,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string {
  return jwt.sign(
    { email: email.trim().toLowerCase() } as UnsubscribeTokenPayload,
    secret,
    { expiresIn: ttlSeconds }
  );
}

/**
 * Verify an unsubscribe token and return the email. Throws if invalid or expired.
 */
export function verifyUnsubscribeToken(token: string, secret: string): string {
  const decoded = jwt.verify(token, secret) as UnsubscribeTokenPayload;
  if (!decoded?.email || typeof decoded.email !== "string") {
    throw new Error("Invalid unsubscribe token payload");
  }
  return decoded.email.trim().toLowerCase();
}
