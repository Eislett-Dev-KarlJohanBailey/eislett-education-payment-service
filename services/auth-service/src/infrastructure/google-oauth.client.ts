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
  private client: null = null; // kept for compatibility
  private config: GoogleOAuthConfig | null = null;

  constructor() {
    this.client = null;
  }

  async initialize(projectName: string, environment: string): Promise<void> {
    const secretName = `${projectName}-${environment}-google-oauth-secret`;
    const secretsClient = new SecretsManagerClient({ region: "us-east-1" });
    console.log(this.client)
    try {
      const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      const secretString = response.SecretString || "";
      const config = JSON.parse(secretString) as GoogleOAuthConfig;

      this.config = config;
    } catch (error) {
      throw new Error(
        `Failed to load Google OAuth config from Secrets Manager: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  getAuthorizationUrl(state?: string): string {
    if (!this.config) {
      throw new Error("GoogleOAuthClient not initialized");
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ].join(" "),
    });

    if (state) {
      params.set("state", state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async getToken(
    code: string,
    redirectUri?: string
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    if (!this.config) {
      throw new Error("GoogleOAuthClient not initialized");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri ?? this.config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get token from Google: ${errorText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) {
      throw new Error("Failed to get access token from Google");
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  }

  async getUserInfoFromAccessToken(accessToken: string): Promise<{
    id: string;
    email: string;
    name?: string;
    picture?: string;
    locale?: string;
  }> {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
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
