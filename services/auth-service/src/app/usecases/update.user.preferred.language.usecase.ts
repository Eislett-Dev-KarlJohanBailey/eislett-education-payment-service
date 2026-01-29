import { UserRepository } from "../../infrastructure/repositories/user.repository";
import { UserEntity } from "../../domain/entities/user.entity";

export interface UpdatePreferredLanguageInput {
  userId: string;
  preferredLanguage: string;
}

export interface UpdatePreferredLanguageOutput {
  userId: string;
  preferredLanguage: string;
}

export class UpdatePreferredLanguageUseCase {
  constructor(
    private readonly userRepo: UserRepository
  ) {}

  async execute(input: UpdatePreferredLanguageInput): Promise<UpdatePreferredLanguageOutput> {
    const { userId, preferredLanguage } = input;

    const user = await this.userRepo.findByUserId(userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Update preferred language
    const updatedUser = new UserEntity(
      user.userId,
      user.email,
      user.role,
      user.name,
      user.picture,
      preferredLanguage,
      user.googleId, // Keep existing googleId (optional)
      user.createdAt,
      new Date()
    );

    await this.userRepo.update(updatedUser);

    return {
      userId: updatedUser.userId,
      preferredLanguage: updatedUser.preferredLanguage || "",
    };
  }
}
