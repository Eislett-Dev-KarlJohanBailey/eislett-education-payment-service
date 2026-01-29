import { GoogleOAuthClient } from "../../infrastructure/google-oauth.client";
import { JwtGenerator } from "../../infrastructure/jwt.generator";
import { UserRepository } from "../../infrastructure/repositories/user.repository";
import { AuthenticationRepository } from "../../infrastructure/repositories/authentication.repository";
import { UserEntity } from "../../domain/entities/user.entity";
import { AuthenticationEntity } from "../../domain/entities/authentication.entity";

export interface GoogleAuthInput {
  code: string;
  role?: string; // Optional role, defaults to "learner"
  preferredLanguage?: string; // Optional preferred language override
}

export interface GoogleAuthOutput {
  token: string;
  user: {
    userId: string;
    email: string;
    name?: string;
    picture?: string;
    role: string;
    preferredLanguage?: string;
  };
}

export class GoogleAuthUseCase {
  constructor(
    private readonly googleOAuthClient: GoogleOAuthClient,
    private readonly jwtGenerator: JwtGenerator,
    private readonly userRepo: UserRepository,
    private readonly authRepo: AuthenticationRepository
  ) {}

  async execute(input: GoogleAuthInput): Promise<GoogleAuthOutput> {
    // Ensure clients are initialized
    const ensureInit = (global as any).__authServiceEnsureInit;
    if (ensureInit) {
      await ensureInit();
    }

    const { code, role = "learner", preferredLanguage } = input;

    // Exchange code for access token
    const tokens = await this.googleOAuthClient.getToken(code);

    // Get user info from Google
    const googleUserInfo = await this.googleOAuthClient.getUserInfoFromAccessToken(
      tokens.access_token
    );

    // Determine preferred language: use provided value, or Google's locale, or keep existing
    const finalPreferredLanguage = preferredLanguage || googleUserInfo.locale;

    // Check if user exists by Google ID
    let user = await this.findUserByGoogleId(googleUserInfo.id);

    if (!user) {
      // Create new user
      user = UserEntity.fromGoogleProfile(
        googleUserInfo.id,
        googleUserInfo.email,
        googleUserInfo.name,
        googleUserInfo.picture,
        role,
        finalPreferredLanguage
      );
      await this.userRepo.save(user);
    } else {
      // Update existing user if needed
      const needsUpdate = 
        user.email !== googleUserInfo.email || 
        user.name !== googleUserInfo.name || 
        user.picture !== googleUserInfo.picture ||
        (role && user.role !== role) ||
        (finalPreferredLanguage && user.preferredLanguage !== finalPreferredLanguage);

      if (needsUpdate) {
        const updatedUser = new UserEntity(
          user.userId,
          googleUserInfo.email,
          role, // Update role if provided
          googleUserInfo.name,
          googleUserInfo.picture,
          finalPreferredLanguage || user.preferredLanguage, // Use new language or keep existing
          googleUserInfo.id, // Update googleId
          user.createdAt,
          new Date()
        );
        await this.userRepo.update(updatedUser);
        user = updatedUser;
      }
    }

    // Save or update authentication record
    const existingAuth = await this.authRepo.findByUserIdAndProvider(
      user.userId,
      "google"
    );

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    const auth = new AuthenticationEntity(
      existingAuth?.authenticationId || `auth-${user.userId}-${Date.now()}`,
      user.userId,
      "google",
      googleUserInfo.id,
      tokens.access_token,
      tokens.refresh_token,
      expiresAt
    );

    await this.authRepo.save(auth);

    // Generate JWT token
    const token = this.jwtGenerator.generateToken(user.userId, user.role);

    return {
      token,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
    };
  }

  private async findUserByGoogleId(googleId: string): Promise<UserEntity | null> {
    // Use provider-agnostic lookup (works for all providers)
    // Falls back to legacy findByGoogleId for backward compatibility
    try {
      return await this.userRepo.findByProviderId("google", googleId);
    } catch (error) {
      // Fallback to legacy method if authRepo not available
      return await this.userRepo.findByGoogleId(googleId);
    }
  }
}
