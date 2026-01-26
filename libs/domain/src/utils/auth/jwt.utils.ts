import jwt from "jsonwebtoken";
import { APIGatewayProxyEvent } from "aws-lambda";
import { AuthenticationError } from "./errors/authentication.error";
import { JwtUser, JwtDecodeOptions } from "./jwt.types";

/**
 * Extracts Bearer token from API Gateway headers
 */
function extractBearerToken(
  event: APIGatewayProxyEvent
): string | null {
  const headers = event.headers || {};

  const authHeader =
    headers.Authorization ||
    headers.authorization;

  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError(
      "Invalid authorization header format. Expected: Bearer <token>"
    );
  }

  return authHeader.substring(7);
}

/**
 * Decode + verify JWT from API Gateway event
 */
export function getCurrentUserFromEvent(
  event: APIGatewayProxyEvent,
  options: JwtDecodeOptions = {}
): JwtUser | null {
  const { required = true } = options;

  try {
    const token = extractBearerToken(event);

    if (!token) {
      if (required) {
        throw new AuthenticationError("Authorization token is required");
      }
      return null;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_TOKEN_SECRET as string,
    ) as JwtUser;

    if (!decoded?.id) {
      throw new AuthenticationError("Invalid token payload");
    }

    return {
      id: decoded.id,
      role: decoded.role,
    };
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof AuthenticationError
    ) {
      if (required) {
        throw new AuthenticationError("Invalid or expired token");
      }
      return null;
    }

    throw error;
  }
}

/**
 * Convenience helpers
 */
export function requireUser(
  event: APIGatewayProxyEvent
): JwtUser {
  const user = getCurrentUserFromEvent(event, { required: true });
  if (!user) {
    throw new AuthenticationError("Unauthorized");
  }
  return user;
}

export function optionalUser(
  event: APIGatewayProxyEvent
): JwtUser | null {
  return getCurrentUserFromEvent(event, { required: false });
}
