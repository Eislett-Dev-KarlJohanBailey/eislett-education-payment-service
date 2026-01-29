import { UserRepository } from "../../infrastructure/repositories/user.repository";

export interface GetCurrentUserInput {
  userId: string;
}

export interface GetCurrentUserOutput {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  role: string;
  preferredLanguage?: string;
  createdAt: string;
  updatedAt: string;
}

export class GetCurrentUserUseCase {
  constructor(
    private readonly userRepo: UserRepository
  ) {}

  async execute(input: GetCurrentUserInput): Promise<GetCurrentUserOutput> {
    const { userId } = input;

    const user = await this.userRepo.findByUserId(userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
