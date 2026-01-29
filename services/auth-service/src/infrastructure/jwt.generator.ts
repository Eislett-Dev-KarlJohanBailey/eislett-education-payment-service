import jwt from "jsonwebtoken";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export class JwtGenerator {
  private secret: string | null = null;

  async initialize(projectName: string, environment: string): Promise<void> {
    const secretName = `${projectName}-${environment}-jwt-access-token-secret`;
    const secretsClient = new SecretsManagerClient({ region: "us-east-1" });

    try {
      const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      const secretString = response.SecretString || "";
      // Handle both JSON and plain string formats
      try {
        const parsed = JSON.parse(secretString);
        this.secret = parsed.key || parsed;
      } catch {
        this.secret = secretString;
      }
    } catch (error) {
      throw new Error(
        `Failed to load JWT secret from Secrets Manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  generateToken(userId: string, role: string): string {
    if (!this.secret) {
      throw new Error("JwtGenerator not initialized");
    }

    return jwt.sign(
      {
        id: userId,
        role: role,
      },
      this.secret,
      {
        expiresIn: "7d", // Token expires in 7 days
      }
    );
  }
}

