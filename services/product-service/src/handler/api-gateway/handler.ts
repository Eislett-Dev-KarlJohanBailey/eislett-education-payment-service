import { APIGatewayProxyEvent } from "aws-lambda";
import { parseRequest } from "./parse-request";
import { routes } from "./routes";
import { response, errorResponse } from "./response";

/**
 * Normalizes the path by removing /v1 prefix if present
 */
function normalizePath(path: string): string {
  if (path.startsWith("/v1/")) {
    return path.substring(3); // Remove "/v1"
  }
  return path;
}

/**
 * Finds a matching route handler by checking if the path starts with the route pattern
 * Supports both exact matches and partial matches (e.g., /v1/products matches /products)
 */
function findRouteHandler(method: string, path: string): ((req: any) => Promise<any>) | null {
  const normalizedPath = normalizePath(path);
  const pathWithoutQuery = normalizedPath.split("?")[0]; // Remove query string
  
  // First try exact match with normalized path
  const exactKey = `${method} ${normalizedPath}`;
  if (routes[exactKey]) {
    return routes[exactKey];
  }
  
  // Try exact match with path without query params
  const exactKeyNoQuery = `${method} ${pathWithoutQuery}`;
  if (routes[exactKeyNoQuery]) {
    return routes[exactKeyNoQuery];
  }
  
  // Sort routes by specificity (longer paths first) to match most specific route first
  const sortedRoutes = Object.entries(routes)
    .filter(([routeKey]) => routeKey.startsWith(`${method} `))
    .sort(([a], [b]) => {
      const pathA = a.split(" ", 2)[1];
      const pathB = b.split(" ", 2)[1];
      return pathB.length - pathA.length; // Longer paths first
    });
  
  // Then try partial match - check if path matches any route pattern
  for (const [routeKey, handler] of sortedRoutes) {
    const [, routePath] = routeKey.split(" ", 2);
    
    // For parameterized routes like /products/{id}, check if path matches the pattern
    // Convert route pattern to regex: /products/{id} -> /products/[^/]+
    const routePattern = routePath.replace(/\{[^}]+\}/g, "[^/]+");
    const routeRegex = new RegExp(`^${routePattern}(?:/|$|\\?|$)`);
    
    if (routeRegex.test(pathWithoutQuery)) {
      return handler;
    }
    
    // For exact non-parameterized routes, check if path exactly matches
    if (pathWithoutQuery === routePath) {
      return handler;
    }
  }
  
  return null;
}

export async function apiHandler(event: APIGatewayProxyEvent) {
  try {
    const req = parseRequest(event);
    const normalizedPath = normalizePath(req.path);
    
    // Update the path in the request context to the normalized version
    const normalizedReq = {
      ...req,
      path: normalizedPath
    };
    
    const handler = findRouteHandler(req.method, req.path);

    if (!handler) {
      return response(404, { message: "Route not found" });
    }

    const result = await handler(normalizedReq);

    // Simple status inference
    if (req.method === "POST") {
      return response(201, result);
    }

    if (req.method === "DELETE") {
      return response(204, null);
    }

    return response(200, result);

  } catch (err) {
    return errorResponse(err);
  }
}