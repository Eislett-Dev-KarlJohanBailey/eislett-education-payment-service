import {
  TrialRepository,
} from "@libs/domain";

export interface CheckTrialStatusInput {
  userId: string;
  productId: string;
}

export interface CheckTrialStatusOutput {
  hasTrialed: boolean;
  trial?: {
    startedAt: string;
    expiresAt: string;
    status: "active" | "expired" | "converted";
    isActive: boolean;
  };
}

export class CheckTrialStatusUseCase {
  constructor(
    private readonly trialRepo: TrialRepository
  ) {}

  async execute(input: CheckTrialStatusInput): Promise<CheckTrialStatusOutput> {
    const { userId, productId } = input;

    const trial = await this.trialRepo.findByUserAndProduct(userId, productId);

    if (!trial) {
      return {
        hasTrialed: false,
      };
    }

    return {
      hasTrialed: true,
      trial: {
        startedAt: trial.startedAt.toISOString(),
        expiresAt: trial.expiresAt.toISOString(),
        status: trial.status,
        isActive: trial.isActive(),
      },
    };
  }
}
