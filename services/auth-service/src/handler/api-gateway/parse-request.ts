import { APIGatewayProxyEvent } from "aws-lambda";
import { RequestContext } from "./types";

export function parseRequest(event: APIGatewayProxyEvent): RequestContext {
  const path = event.resource || event.path;

  let body: any = null;
  if (event.body) {
    try {
      const rawBody =
        (event as any).isBase64Encoded === true
          ? Buffer.from(event.body, "base64").toString("utf8")
          : event.body;
      body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch (error) {
      body = event.body;
    }
  }
  
  const pathParams: Record<string, string> = {};
  if (event.pathParameters) {
    for (const [key, value] of Object.entries(event.pathParameters)) {
      if (value !== undefined) {
        pathParams[key] = value;
      }
    }
  }
  
  const query: Record<string, string> = {};
  if (event.queryStringParameters) {
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (value !== undefined) {
        query[key] = value;
      }
    }
  }

  const headers: Record<string, string> = {};
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value !== undefined) {
        headers[key.toLowerCase()] = value;
      }
    }
  }
  
  return {
    method: event.httpMethod,
    path: path,
    pathParams: pathParams,
    query: query,
    body: body,
    headers: headers,
  };
}
