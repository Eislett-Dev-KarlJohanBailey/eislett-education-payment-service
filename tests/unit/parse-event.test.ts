import type { SQSEvent, SQSRecord } from "aws-lambda";
import {
  parseSqsEvent,
  parseSqsRecord,
} from "../../services/entitlement-service/src/handler/sqs/parse-event";
import { describe, it, expect } from "@jest/globals";

// sqs is direct and then sns is a notification with the actual message in the Message field.
describe("parse-SQS-record", () => {
  it("should parse valid SQS event with SNS message", () => {
    const billingEvent = require("../fixtures/billing-event-subscription-created.json");

    const record = {
      body: JSON.stringify(billingEvent),
    } as SQSRecord;

    const result = parseSqsRecord(record);
    expect(result.type).toBe("subscription.created");
    expect(result.payload.userId).toBe("user-1");
    expect(result.payload.productId).toBe("prod-1");
    expect(result.meta.eventId).toBe("evt-1");
  });

  it("should parse an SNS notification message", () => {
    const snsEnvelope = require("../fixtures/sns-wrapped-subscription-created.json");

    const record = {
      body: JSON.stringify(snsEnvelope),
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
    const event = require("../fixtures/sqs-event-two-record.json") as SQSEvent;

    const results = parseSqsEvent(event);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe("subscription.created");
    expect(results[0].payload.userId).toBe("user-1");
    expect(results[1].type).toBe("payment.successful");
    expect(results[1].payload.userId).toBe("user-2");
  });
});
