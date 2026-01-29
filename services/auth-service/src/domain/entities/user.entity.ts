export interface User {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  role: string;
  googleId?: string; // Optional - only for Google users
  preferredLanguage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserEntity {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: string,
    public readonly name?: string,
    public readonly picture?: string,
    public readonly preferredLanguage?: string,
    public readonly googleId?: string, // Optional - only for Google users
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static fromGoogleProfile(
    googleId: string,
    email: string,
    name?: string,
    picture?: string,
    role: string = "learner",
    preferredLanguage?: string
  ): UserEntity {
    return new UserEntity(
      `user-${googleId}`, // Generate userId from googleId
      email,
      role,
      name,
      picture,
      preferredLanguage,
      googleId // Store googleId for backward compatibility
    );
  }
}
