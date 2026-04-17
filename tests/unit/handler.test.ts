import type { SQSEvent, SQSRecord } from "aws-lambda";
import { bootstrap } from "../../services/entitlement-service/src/bootstrap";
import { handler } from "../../services/entitlement-service/src/handler/index";
import sqsEvent from "../fixtures/sqs-event-two-record.json";

jest.mock("../../services/entitlement-service/src/bootstrap", () => ({
  // when calling the module , replace with the fake one
  bootstrap: jest.fn(),
}));

const mockedBootstrap = bootstrap as jest.Mock; // cast the mocked function to the correct type

function sqsRecordWithBody(body: unknown): SQSRecord {
  return {
    body: JSON.stringify(body),
  } as SQSRecord;
}

function makesqsEvent(body: unknown): SQSEvent {
  return body as SQSEvent;
}

describe("entitlement-service handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a partial batch failure when the second record fails", async () => {
    const execute = jest // fake execution
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom")); // mockintg that the second record processing fails

    mockedBootstrap.mockReturnValue({
      // return fake object
      processBillingEventUseCase: {
        execute,
      },
    });

    const event = makesqsEvent(sqsEvent);

    const response = await handler(event);

    expect(mockedBootstrap).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(response.batchItemFailures).toEqual([{ itemIdentifier: "msg-2" }]);
  });
});
