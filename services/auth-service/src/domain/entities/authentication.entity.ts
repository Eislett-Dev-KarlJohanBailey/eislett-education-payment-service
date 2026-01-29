export type AuthProvider = "google" | "email" | "facebook" | "apple" | string;

export interface Authentication {
  authenticationId: string;
  userId: string;
  provider: AuthProvider;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthenticationEntity {
  constructor(
    public readonly authenticationId: string,
    public readonly userId: string,
    public readonly provider: AuthProvider,
    public readonly providerId: string,
    public readonly accessToken?: string,
    public readonly refreshToken?: string,
    public readonly expiresAt?: Date,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}
}
