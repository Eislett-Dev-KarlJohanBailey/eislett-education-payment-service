import { APIGatewayProxyEvent } from "aws-lambda";
import { RequestContext } from "./types";

export function parseRequest(event: APIGatewayProxyEvent): RequestContext {
  const path = event.resource || event.path;
  
  // Check if this is a webhook request - webhooks need raw body string for signature verification
  // API Gateway may send path as /v1/stripe/webhook or /stripe/webhook
  // Check both the original path and resource path
  const isWebhook = (path && (path.includes("/webhook") || path.endsWith("/webhook"))) ||
                    (event.path && (event.path.includes("/webhook") || event.path.endsWith("/webhook")));
  
  let body: any = null;
  if (event.body) {
    if (isWebhook) {
      // For webhooks, keep body as raw string for Stripe signature verification
      // Stripe requires the original raw body string, not a parsed object
      // API Gateway sends body as a string, so we keep it as-is
      body = event.body;
      console.log("Webhook detected: keeping body as raw string for signature verification");
    } else {
      // For other requests, parse JSON
      try {
        body = JSON.parse(event.body);
      } catch (error) {
        // If parsing fails, keep as string
        body = event.body;
      }
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
    // Store raw body for webhooks - always keep original event.body as rawBody
    rawBody: event.body || undefined,
  };
}
