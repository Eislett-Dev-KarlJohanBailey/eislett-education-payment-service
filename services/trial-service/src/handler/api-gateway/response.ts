import { APIGatewayProxyResult } from "aws-lambda";

export function response(
  statusCode: number,
  body: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

export function errorResponse(error: any): APIGatewayProxyResult {
  // Authentication errors
  if (error.name === "AuthenticationError") {
    return response(401, {
      error: "UNAUTHORIZED",
      message: error.message
    });
  }

  // Domain & app errors
  if (error.name === "NotFoundError") {
    return response(404, {
      error: "NOT_FOUND",
      message: error.message
    });
  }

  if (error.name === "DomainError") {
    // Check if it's a conflict (already exists) error
    if (error.message.includes("already has a trial")) {
      return response(409, {
        error: "CONFLICT",
        message: error.message
      });
    }
    return response(400, {
      error: "DOMAIN_ERROR",
      message: error.message
    });
  }

  // Validation (optional)
  if (error.name === "ValidationError") {
    return response(400, {
      error: "VALIDATION_ERROR",
      message: error.message,
      details: error.details
    });
  }

  // Fallback (log for debugging, but never leak internals to client)
  console.error("Unhandled error:", error);
  console.error("Error stack:", error.stack);
  console.error("Error name:", error.name);
  console.error("Error message:", error.message);

  return response(500, {
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong"
  });
}
