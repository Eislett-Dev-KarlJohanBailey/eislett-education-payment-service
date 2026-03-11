import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { NoReplySecret } from "../types";

export async function getNoReplySecret(
  secretName: string,
  client: SecretsManagerClient = new SecretsManagerClient({})
): Promise<NoReplySecret> {
  const resp = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const raw = resp.SecretString;
  if (!raw) throw new Error("NoReply secret is empty");
  const parsed = JSON.parse(raw) as Record<string, string>;
  const user = parsed.user ?? parsed.username;
  const password = parsed.password ?? parsed.pass;
  const service = parsed.service ?? parsed.host ?? "smtp.gmail.com";
  if (!user || !password)
    throw new Error("NoReply secret must have user and password");
  const from = parsed.from ?? parsed.fromAddress ?? user;
  return { user, password, service, from };
}

/**
 * Get the JWT signing key for email unsubscribe tokens.
 * Secret may be stored as raw string or JSON with a "key" field.
 */
export async function getJwtEmailSecret(
  secretName: string,
  client: SecretsManagerClient = new SecretsManagerClient({})
): Promise<string> {
  const resp = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const raw = resp.SecretString;
  if (!raw) throw new Error("JWT email secret is empty");
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.key ?? parsed.secret ?? raw;
  } catch {
    return raw;
  }
}
