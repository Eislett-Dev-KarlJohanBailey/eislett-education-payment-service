import { OAuth2Client } from "google-auth-library";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleOAuthClient {
  private client: OAuth2Client;
  private config: GoogleOAuthConfig | null = null;

  constructor() {
    this.client = new OAuth2Client();
  }

  async initialize(projectName: string, environment: string): Promise<void> {
    const secretName = `${projectName}-${environment}-google-oauth-secret`;
    const secretsClient = new SecretsManagerClient({ region: "us-east-1" });

    try {
      const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      const secretString = response.SecretString || "";
      const config = JSON.parse(secretString) as GoogleOAuthConfig;

      this.client = new OAuth2Client({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });

      this.config = config;
    } catch (error) {
      throw new Error(
        `Failed to load Google OAuth config from Secrets Manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getAuthorizationUrl(state?: string): string {
    if (!this.config) {
      throw new Error("GoogleOAuthClient not initialized");
    }

    return this.client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      state,
    });
  }

  async getToken(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const { tokens } = await this.client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error("Failed to get access token from Google");
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      expires_in: tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : undefined,
    };
  }

  async getUserInfoFromAccessToken(accessToken: string): Promise<{
    id: string;
    email: string;
    name?: string;
    picture?: string;
    locale?: string; // Preferred language from Google
  }> {
    // Use Google's userinfo endpoint
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get user info from Google: ${errorText}`);
    }

    const data = (await response.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
      locale?: string;
    };
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
      locale: data.locale,
    };
  }
}
