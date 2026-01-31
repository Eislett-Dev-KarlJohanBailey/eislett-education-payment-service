import { APIGatewayProxyResult } from "aws-lambda";

export function response(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function getErrorMessage(error: any): string {
  const msg = error?.message;
  const data = error?.response?.data;
  if (data?.error_description) return data.error_description;
  if (data?.error && typeof data.error === "string") return data.error;
  if (typeof msg === "string" && msg) return msg;
  return "An unexpected error occurred";
}

export function errorResponse(error: any): APIGatewayProxyResult {
  console.error("Error:", error);

  if (error.name === "ValidationError") {
    return response(400, {
      error: "VALIDATION_ERROR",
      message: error.message,
    });
  }

  if (error.name === "NotFoundError") {
    return response(404, {
      error: "NOT_FOUND",
      message: error.message,
    });
  }

  if (error.name === "AuthenticationError") {
    return response(401, {
      error: "UNAUTHORIZED",
      message: error.message,
    });
  }

  const message = getErrorMessage(error);

  // Google OAuth / token errors: return 400 so client sees the real reason
  const isAuthClientError =
    message.includes("redirect_uri") ||
    message.includes("invalid_grant") ||
    message.includes("invalid_request") ||
    message.includes("access_denied") ||
    (error?.response?.status && error.response.status >= 400 && error.response.status < 500);
  if (isAuthClientError) {
    return response(400, {
      error: "AUTH_ERROR",
      message,
    });
  }

  return response(500, {
    error: "INTERNAL_ERROR",
    message,
  });
}
