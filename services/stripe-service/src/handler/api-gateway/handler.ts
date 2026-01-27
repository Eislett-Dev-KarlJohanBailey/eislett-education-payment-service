import { APIGatewayProxyEvent } from "aws-lambda";
import { parseRequest } from "./parse-request";
import { routes } from "./routes";
import { response, errorResponse } from "./response";
import { requireUser } from "@libs/domain";

function normalizePath(path: string): string {
  if (path.startsWith("/v1/")) {
    return path.substring(3);
  }
  return path;
}

function findRouteHandler(method: string, path: string): ((req: any) => Promise<any>) | null {
  const normalizedPath = normalizePath(path);
  const pathWithoutQuery = normalizedPath.split("?")[0];
  
  const exactKey = `${method} ${pathWithoutQuery}`;
  if (routes[exactKey]) {
    return routes[exactKey];
  }
  
  return null;
}

export async function apiHandler(event: APIGatewayProxyEvent) {
  try {
    console.log("Received event:", JSON.stringify(event, null, 2));
    
    const req = parseRequest(event);
    const actualPath = event.path || req.path;
    const normalizedPath = normalizePath(actualPath);
    
    // Webhook doesn't require auth, payment intent does
    const isWebhook = normalizedPath.includes("/webhook");
    let user: { id: string; role?: string } | null = null;
    if (!isWebhook) {
      user = requireUser(event);
    }
    
    const requestWithUser = {
      ...req,
      path: normalizedPath,
      user: user || undefined,
    };
    
    const handler = findRouteHandler(req.method, normalizedPath);

    if (!handler) {
      console.log("No handler found for:", `${req.method} ${req.path}`);
      return response(404, { message: "Route not found" });
    }

    const result = await handler(requestWithUser);
    console.log("Handler executed successfully");

    return response(200, result);

  } catch (err) {
    console.error("Error in apiHandler:", err);
    return errorResponse(err);
  }
}
