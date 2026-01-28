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
    
    const user = requireUser(event);
    console.log("Authenticated user:", { id: user.id, role: user.role });
    
    const req = parseRequest(event);
    const actualPath = event.path || req.path;
    const normalizedPath = normalizePath(actualPath);
    
    const requestWithUser = {
      ...req,
      path: normalizedPath,
      user: user
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
