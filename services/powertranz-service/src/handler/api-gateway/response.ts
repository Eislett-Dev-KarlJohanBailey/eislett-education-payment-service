import { APIGatewayProxyResult } from "aws-lambda";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

export function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function errorResponse(error: any): APIGatewayProxyResult {
  if (error?.name === "ValidationError") {
    return response(400, {
      error: "VALIDATION_ERROR",
      message: error.message || "Validation failed",
    });
  }

  if (error?.name === "DomainError") {
    return response(400, {
      error: "DOMAIN_ERROR",
      message: error.message || "Domain error",
    });
  }

  if (error?.name === "NotFoundError") {
    return response(404, {
      error: "NOT_FOUND",
      message: error.message || "Not found",
    });
  }

  console.error("Unhandled error:", error);

  return response(500, {
    error: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
  });
}
