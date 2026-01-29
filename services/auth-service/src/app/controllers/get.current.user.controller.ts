import { RequestContext } from "../../handler/api-gateway/types";
import { GetCurrentUserUseCase } from "../usecases/get.current.user.usecase";

export class GetCurrentUserController {
  constructor(
    private readonly useCase: GetCurrentUserUseCase
  ) {}

  handle = async (req: RequestContext & { user: { id: string } }) => {
    const userId = req.user.id;

    if (!userId) {
      throw new Error("User ID is required");
    }

    return await this.useCase.execute({ userId });
  };
}
