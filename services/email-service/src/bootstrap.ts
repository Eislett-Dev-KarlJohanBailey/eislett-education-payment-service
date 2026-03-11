import { S3TemplatesClient } from "./infrastructure/s3.client";
import { TemplateService } from "./infrastructure/template.service";
import { EmailsSentRepository, UnsubscribesRepository } from "./infrastructure/dynamodb.client";
import { SendEmailUseCase } from "./app/send.email.usecase";
import { UnsubscribeController } from "./app/unsubscribe.controller";

export function bootstrap() {
  const emailsSentTable = process.env.EMAILS_SENT_TABLE;
  const unsubscribesTable = process.env.UNSUBSCRIBES_TABLE;
  const templatesBucket = process.env.TEMPLATES_BUCKET;
  const noReplySecretName = process.env.NO_REPLY_SECRET_NAME;
  const jwtEmailSecretName = process.env.JWT_EMAIL_SERVICE_SECRET_NAME;

  if (!emailsSentTable || !unsubscribesTable || !templatesBucket || !noReplySecretName || !jwtEmailSecretName) {
    throw new Error(
      "Missing env: EMAILS_SENT_TABLE, UNSUBSCRIBES_TABLE, TEMPLATES_BUCKET, NO_REPLY_SECRET_NAME, JWT_EMAIL_SERVICE_SECRET_NAME"
    );
  }

  const s3 = new S3TemplatesClient(templatesBucket);
  const templateService = new TemplateService(s3);
  const emailsSentRepo = new EmailsSentRepository(emailsSentTable);
  const unsubscribesRepo = new UnsubscribesRepository(unsubscribesTable);

  const sendEmailUseCase = new SendEmailUseCase(
    templateService,
    emailsSentRepo,
    unsubscribesRepo,
    noReplySecretName,
    process.env.JWT_EMAIL_SERVICE_SECRET_NAME,
    process.env.UNSUBSCRIBE_BASE_URL
  );

  const unsubscribeController = new UnsubscribeController(unsubscribesRepo, jwtEmailSecretName);

  return {
    sendEmailUseCase,
    unsubscribesRepo,
    unsubscribeController,
  };
}
