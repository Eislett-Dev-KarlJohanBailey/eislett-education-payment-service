import { bootstrap } from "../../bootstrap";
import { RequestContext } from "./types";

const {
  googleAuthController,
  updatePreferredLanguageController,
  getCurrentUserController,
} = bootstrap();

export const routes: Record<
  string,
  (req: RequestContext) => Promise<any>
> = {
  "POST /auth/google": googleAuthController.handle,
  "PUT /auth/user/preferred-language": updatePreferredLanguageController.handle as any,
  "GET /auth/me": getCurrentUserController.handle as any,
};
