import { RequestContext } from "../../handler/api-gateway/types";
import { HandlePowerTranzCallbackUseCase } from "../usecases/handle.powertranz.callback.usecase";

export class PowerTranzCallbackController {
  // for accepting the powertranz callback payload and then sends it to the usecase
  constructor(private readonly useCase: HandlePowerTranzCallbackUseCase) {}

  handle = async (req: RequestContext) => {
    const payload = req.body;

    if (!payload || typeof payload !== "object") {
      const error = new Error("Invalid payload");
      error.name = "ValidationError";
      throw error;
    }

    return await this.useCase.execute({
      payload,
    });
  };
}
