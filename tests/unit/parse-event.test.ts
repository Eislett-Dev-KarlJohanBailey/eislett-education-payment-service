import type { SQSEvent, SQSRecord } from "aws-lambda";
import {
  parseSqsEvent,
  parseSqsRecord,
} from "../../services/entitlement-service/src/handler/sqs/parse-event";
import { describe, it, expect } from "@jest/globals";

// sqs is direct and then sns is a notification with the actual message in the Message field.
describe("parse-SQS-record", () => {
  it("should parse valid SQS event with SNS message", () => {
    const record = {
      messageId: "msg-1",
      receiptHandle: "rh-1",
      body: JSON.stringify({
        type: "subscription.created",
        payload: {
          userId: "user-1",
          productId: "prod-1",
          currentPeriodEnd: "2026-05-17T12:00:00.000Z",
        },
        meta: {
          eventId: "evt-1",
          occurredAt: "2026-04-17T12:00:00.000Z",
        },
        version: 1,
      }),
    } as SQSRecord;

    const result = parseSqsRecord(record);
    expect(result.type).toBe("subscription.created");
    expect(result.payload.userId).toBe("user-1");
    expect(result.payload.productId).toBe("prod-1");
    expect(result.meta.eventId).toBe("evt-1");
  });

  it("should parse an SNS notification message", () => {
    const record = {
      body: JSON.stringify({
        Type: "Notification",
        Message: JSON.stringify({
          type: "subscription.created",
          payload: {
            userId: "user-1",
            productId: "prod-1",
            currentPeriodEnd: "2026-05-17T12:00:00.000Z",
          },
          meta: {
            eventId: "evt-1",
            occurredAt: "2026-04-17T12:00:00.000Z",
          },
          version: 1,
        }),
      }),
    } as SQSRecord;

    const result = parseSqsRecord(record);

    expect(result.type).toBe("subscription.created");
    expect(result.payload.userId).toBe("user-1");
    expect(result.payload.productId).toBe("prod-1");
    expect(result.meta.eventId).toBe("evt-1");
  });

  // when a field is missing , throw an error
  it("should throw an error if required fields are missing", () => {
    const record = {
      body: JSON.stringify({
        payload: {},
        meta: {},
      }),
    } as SQSRecord;

    expect(() => parseSqsRecord(record)).toThrow(
      "Invalid billing event structure: missing required fields",
    );
  });

  it("should parse multiple records in an SQS event", () => {
    const event = {
      Records: [
        {
          messageId: "msg-1",
          receiptHandle: "rh-1",
          body: JSON.stringify({
            type: "subscription.created",
            payload: { userId: "user-1" },
            meta: { eventId: "evt-1" },
            version: 1,
          }),
        },
        {
          messageId: "msg-2",
          receiptHandle: "rh-2",
          body: JSON.stringify({
            type: "payment.successful",
            payload: { userId: "user-2" },
            meta: { eventId: "evt-2" },
            version: 1,
          }),
        },
      ],
    } as SQSEvent;

    const results = parseSqsEvent(event);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe("subscription.created");
    expect(results[0].payload.userId).toBe("user-1");
    expect(results[1].type).toBe("payment.successful");
    expect(results[1].payload.userId).toBe("user-2");
  });
});
