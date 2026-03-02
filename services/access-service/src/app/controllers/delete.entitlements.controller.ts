import { RequestContext } from "../../handler/api-gateway/types";
import { EntitlementRepository } from "@libs/domain";

const ALLOWED_ENVS = ["dev", "development"];

function isDevEnvironment(): boolean {
  const env = (process.env.ENVIRONMENT ?? "").toLowerCase();
  return ALLOWED_ENVS.includes(env);
}

export class DeleteAllEntitlementsController {
  constructor(private readonly entitlementRepo: EntitlementRepository) {}

  handle = async (_req: RequestContext) => {
    if (!isDevEnvironment()) {
      const err = new Error("Delete all entitlements is only allowed in dev or development environment");
      (err as any).name = "ForbiddenError";
      (err as any).statusCode = 403;
      throw err;
    }
    const result = await this.entitlementRepo.deleteAll();
    return { deleted: result.deleted, message: `Deleted ${result.deleted} entitlement(s)` };
  };
}

export class DeleteEntitlementByKeyController {
  constructor(private readonly entitlementRepo: EntitlementRepository) {}

  handle = async (req: RequestContext) => {
    if (!isDevEnvironment()) {
      const err = new Error("Delete entitlement by key is only allowed in dev or development environment");
      (err as any).name = "ForbiddenError";
      (err as any).statusCode = 403;
      throw err;
    }
    const userId = req.user?.id;
    const key = req.pathParams?.key;
    if (!userId) {
      const err = new Error("Authorization required");
      (err as any).name = "AuthenticationError";
      throw err;
    }
    if (!key) {
      const err = new Error("Entitlement key is required");
      (err as any).name = "ValidationError";
      throw err;
    }
    const deleted = await this.entitlementRepo.deleteByUserAndKey(userId, key);
    if (!deleted) {
      const err = new Error(`Entitlement not found for key: ${key}`);
      (err as any).name = "NotFoundError";
      throw err;
    }
    return { deleted: true, key, message: `Deleted entitlement ${key} for user` };
  };
}
