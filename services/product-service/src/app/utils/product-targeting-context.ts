import { RequestContext } from "../../handler/api-gateway/types";

export interface ProductTargetingContext {
  userId?: string;
  country?: string;
  ipAddress?: string;
}

export function buildProductRequestContext(
  req: RequestContext & { user?: { id?: string } },
  entitlementKey?: string,
): ProductTargetingContext {
  const userId = req.user?.id?.trim() || undefined;

  const countryHeader =
    req.headers["cloudfront-viewer-country"] ||
    req.headers["cloudfront-viewer-country-name"];

  const country = countryHeader?.trim().toUpperCase() || undefined;

  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() || req.sourceIp?.trim() || undefined;

  return {
    userId,
    country,
    ipAddress,
  };
}
