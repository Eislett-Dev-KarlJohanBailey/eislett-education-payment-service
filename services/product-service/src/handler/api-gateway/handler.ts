import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parseRequest } from "./parse-request";
import { routes } from "./routes";
import { response, errorResponse } from "./response";


export async function apiHandler(event: APIGatewayProxyEvent) {
  try {
    const req = parseRequest(event);
    const routeKey = `${req.method} ${req.path}`;
    const handler = routes[routeKey];

    if (!handler) {
      return response(404, { message: "Route not found" });
    }

    const result = await handler(req);

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