import { RequestContext } from "../../handler/api-gateway/types";
import { GoogleAuthUseCase } from "../usecases/google.auth.usecase";

export class GoogleAuthController {
  constructor(
    private readonly useCase: GoogleAuthUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const body = req.body ?? {};
    const { code, role, preferredLanguage, redirectUri } = body;

    if (!code) {
      throw new Error("code is required");
    }

    return await this.useCase.execute({
      code,
      role: typeof role === "string" ? role : undefined,
      preferredLanguage: typeof preferredLanguage === "string" ? preferredLanguage : undefined,
      redirectUri: typeof redirectUri === "string" ? redirectUri : undefined,
    });
  };
}
