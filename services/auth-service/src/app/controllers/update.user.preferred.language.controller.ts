import { RequestContext } from "../../handler/api-gateway/types";
import { UpdatePreferredLanguageUseCase } from "../usecases/update.user.preferred.language.usecase";

export class UpdatePreferredLanguageController {
  constructor(
    private readonly useCase: UpdatePreferredLanguageUseCase
  ) {}

  handle = async (req: RequestContext & { user: { id: string } }) => {
    const { preferredLanguage } = req.body;
    const userId = req.user.id;

    if (!preferredLanguage || typeof preferredLanguage !== "string") {
      throw new Error("preferredLanguage is required and must be a string");
    }

    return await this.useCase.execute({
      userId,
      preferredLanguage,
    });
  };
}
