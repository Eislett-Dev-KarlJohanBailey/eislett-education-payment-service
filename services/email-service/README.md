# Email Service

Sends emails from an SQS queue using Handlebars (HBS) templates stored in S3. Tracks sent emails in DynamoDB and supports unsubscribe via API Gateway.

## Queue message shape

Send a message to the email queue with:

- **template** (optional): S3 key of the HBS file (e.g. `welcome.hbs`). If omitted, the body is taken from `content.message` (plain text/no template).
- **header**: Subject line.
- **to**: Recipient email address (must be the email; no user id or enrichment/lookup).
- **content**: Object passed to the Handlebars template (or `{ message: "..." }` when no template). If `unsubscribeUrl` is omitted and `UNSUBSCRIBE_BASE_URL` is set, the service injects a signed JWT unsubscribe link.

Example with template:

```json
{
  "template": "welcome.hbs",
  "header": "Welcome",
  "to": "user@example.com",
  "content": {
    "title": "Welcome",
    "message": "Thanks for signing up.",
    "siteName": "My App"
  }
}
```
(If `UNSUBSCRIBE_BASE_URL` is configured, `content.unsubscribeUrl` is set automatically with a signed token.)

Example without template:

```json
{
  "header": "Reminder",
  "to": "user@example.com",
  "content": {
    "message": "This is a plain text reminder."
  }
}
```

## Templates (S3)

Bucket: `{project_name}-{env}-email-service-templates`.

- **layout.hbs**: Optional layout partial (registered as `layout`).
- **partials/header.hbs**, **partials/footer.hbs**: Partials for header/footer.
- **partials/*.hbs**: Any other partials (name = filename without `.hbs`).
- **welcome.hbs**, etc.: Page templates; receive `content` and can use `{{> header}}`, `{{> footer}}`.

Partials use the **same** `content` object as the main template. Any variable you put in `content` (e.g. `siteName`, `unsubscribeUrl`) is available in partials—e.g. `{{siteName}}` in `header.hbs` and `{{unsubscribeUrl}}` in `footer.hbs`.

Upload the files from `services/email-service/templates/` (e.g. `layout.hbs`, `partials/header.hbs`, `partials/footer.hbs`, `welcome.hbs`) to the bucket.

## No-reply secret (Secrets Manager)

Create a secret in AWS Secrets Manager with:

- **Name:** `{project_name}-{env}-no-reply-email` (e.g. `eislett-education-dev-no-reply-email`)

Store the value as **plaintext JSON** with these fields:

| Field      | Required | Description |
|-----------|----------|-------------|
| `user`    | Yes*     | SMTP login / sender email. Alternate key: `username`. |
| `password`| Yes*     | SMTP password (e.g. app password for Gmail). Alternate key: `pass`. |
| `service` | No       | SMTP host (e.g. `smtp.gmail.com`). Alternate key: `host`. Default: `smtp.gmail.com`. |
| `from`    | No       | From address shown in emails (e.g. `"My App <noreply@example.com>"`). Alternate key: `fromAddress`. If omitted, `user` is used. |

\* At least `user` and `password` (or their alternates) must be present.

**Example secret value (JSON):**

```json
{
  "user": "noreply@example.com",
  "password": "your-app-password",
  "service": "smtp.gmail.com",
  "from": "My App <noreply@example.com>"
}
```

**Minimal (Gmail):**

```json
{
  "user": "noreply@example.com",
  "password": "xxxx-xxxx-xxxx-xxxx"
}
```

## JWT email secret (Secrets Manager)

Used to sign and verify unsubscribe tokens (email + TTL). Create a secret in AWS Secrets Manager:

- **Name:** `{project_name}-{env}-jwt-email-service` (e.g. `eislett-education-dev-jwt-email-service`)

Store the value as a **plain string** (the HMAC key), or as JSON with a `key` or `secret` field. Example JSON:

```json
{ "key": "your-secret-signing-key-at-least-32-chars" }
```

The unsubscribe controller verifies the token and reads the email from the payload. The send flow can sign tokens when `JWT_EMAIL_SERVICE_SECRET_NAME` and `UNSUBSCRIBE_BASE_URL` are set.

## Unsubscribe API

- **GET** `/v1/email/unsubscribe?token=<jwt>`
- **POST** `/v1/email/unsubscribe` with body `{ "token": "<jwt>" }`

The `token` is a JWT signed with the jwt-email-service secret, containing the subscriber email and a TTL (default 30 days). The controller verifies the token and unsubscribes the email from the payload. No raw email in the URL.

## Build and package

```bash
cd services/email-service
npm install
npm run package
```

Then deploy the Terraform in `infra/services/email-service/` (and ensure the S3 templates bucket is populated and the no-reply secret exists).
