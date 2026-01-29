# Auth Service

A serverless Lambda function service for Google OAuth authentication and JWT token generation. This service handles user authentication via Google, stores user and authentication records in DynamoDB, and generates JWT tokens for API access.

## Overview

The Auth Service provides:
- **Google OAuth Integration**: Authenticate users via Google OAuth 2.0
- **JWT Token Generation**: Generate JWT tokens with user ID and role
- **User Management**: Store user profiles in DynamoDB
- **Authentication Tracking**: Track login sessions and OAuth tokens

## Features

- **Google OAuth 2.0**: Full OAuth flow with code exchange
- **JWT Generation**: Secure JWT tokens with configurable expiration
- **User Storage**: DynamoDB table for user profiles
- **Authentication Logs**: Track authentication events and tokens
- **Role Support**: Dynamic role assignment (any string value)
- **Secrets Management**: Google OAuth and JWT secrets from AWS Secrets Manager

## Architecture

```
src/
├── domain/                    # Domain layer
│   └── entities/              # User and Authentication entities
├── infrastructure/            # Infrastructure layer
│   ├── repositories/          # DynamoDB repositories
│   ├── google-oauth.client.ts # Google OAuth client
│   └── jwt.generator.ts       # JWT token generator
├── app/                       # Application layer
│   ├── usecases/             # Business logic
│   └── controllers/          # API Gateway handlers
├── handler/                   # Lambda handlers
│   └── api-gateway/          # API Gateway handler
└── bootstrap.ts              # Dependency injection
```

## API Endpoints

### Google Authentication

**Endpoint**: `POST /auth/google`

**Request Body**:
```json
{
  "code": "4/0A...",           // OAuth authorization code from Google
  "role": "learner",            // Optional: user role (defaults to "learner")
  "preferredLanguage": "en"     // Optional: preferred language (defaults to Google's locale)
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "user-123456789",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/...",
    "role": "learner",
    "preferredLanguage": "en"
  }
}
```

### Get Current User

**Endpoint**: `GET /auth/me`

**Authentication**: Required (Bearer token)

**Response** (200 OK):
```json
{
  "userId": "user-123456789",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/...",
  "role": "learner",
  "preferredLanguage": "en",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: User not found

### Update Preferred Language

**Endpoint**: `PUT /auth/user/preferred-language`

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "preferredLanguage": "fr"  // Language code (e.g., "en", "fr", "es", "de")
}
```

**Response** (200 OK):
```json
{
  "userId": "user-123456789",
  "preferredLanguage": "fr"
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid `preferredLanguage`
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: User not found

**Error Responses**:
- `400 Bad Request`: Missing or invalid `code`
- `500 Internal Server Error`: Failed to authenticate with Google or generate token

## Environment Variables

| Variable                 | Description |
|--------------------------|-------------|
| `USERS_TABLE`            | DynamoDB table name for users |
| `AUTHENTICATIONS_TABLE` | DynamoDB table name for authentications |
| `USER_EVENTS_TOPIC_ARN`  | SNS topic ARN for publishing user events (optional) |
| `PROJECT_NAME`           | Project name for Secrets Manager (default: "eislett-education") |
| `ENVIRONMENT`            | Environment name (default: "dev") |

## Secrets Configuration

The service requires two secrets in AWS Secrets Manager:

### 1. JWT Access Token Secret

**Name**: `{project-name}-{environment}-jwt-access-token-secret`

**Format**: Plain string or JSON with `{"key": "your-secret"}`

**Example**:
```bash
aws secretsmanager create-secret \
  --name "eislett-education-dev-jwt-access-token-secret" \
  --secret-string "your-jwt-secret-key-here" \
  --region us-east-1
```

### 2. Google OAuth Secret

**Name**: `{project-name}-{environment}-google-oauth-secret`

**Format**: JSON with Google OAuth credentials

**Example**:
```json
{
  "clientId": "your-google-client-id.apps.googleusercontent.com",
  "clientSecret": "your-google-client-secret",
  "redirectUri": "https://your-domain.com/auth/google/callback"
}
```

**Create Secret**:
```bash
aws secretsmanager create-secret \
  --name "eislett-education-dev-google-oauth-secret" \
  --secret-string '{"clientId":"...","clientSecret":"...","redirectUri":"..."}' \
  --region us-east-1
```

## Google OAuth Setup

1. **Create OAuth 2.0 Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URIs

2. **Store Credentials**:
   - Store `clientId`, `clientSecret`, and `redirectUri` in AWS Secrets Manager
   - Use the format shown above

3. **Frontend Flow**:
   ```javascript
   // 1. Redirect user to Google OAuth
   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=email profile`;
   window.location.href = authUrl;
   
   // 2. After redirect, get code from query params
   const code = new URLSearchParams(window.location.search).get('code');
   
   // 3. Exchange code for JWT token
   const response = await fetch('/auth/google', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ code, role: 'learner' })
   });
   const { token, user } = await response.json();
   ```

## DynamoDB Schema

### Users Table

**Table Name**: `{project-name}-{environment}-users`

**Primary Key**:
- `PK` (Partition Key): `USER#{userId}`
- `SK` (Sort Key): `PROFILE`

**GSI1** (for Google ID lookup):
- `GSI1PK`: `GOOGLE#{googleId}`
- `GSI1SK`: `PROFILE`

**Attributes**:
- `userId` (String) - User ID
- `email` (String) - User email
- `name` (String, optional) - User name
- `picture` (String, optional) - Profile picture URL
- `role` (String) - User role (any string)
- `googleId` (String) - Google user ID
- `preferredLanguage` (String, optional) - Preferred language code (e.g., "en", "fr", "es")
- `createdAt` (String - ISO 8601)
- `updatedAt` (String - ISO 8601)

### Authentications Table

**Table Name**: `{project-name}-{environment}-authentications`

**Primary Key**:
- `PK` (Partition Key): `USER#{userId}`
- `SK` (Sort Key): `AUTH#{provider}`

**Attributes**:
- `authenticationId` (String) - Unique authentication ID
- `userId` (String) - User ID
- `provider` (String) - OAuth provider ("google")
- `providerId` (String) - Provider user ID
- `accessToken` (String, optional) - OAuth access token
- `refreshToken` (String, optional) - OAuth refresh token
- `expiresAt` (String - ISO 8601, optional) - Token expiration
- `createdAt` (String - ISO 8601)
- `updatedAt` (String - ISO 8601)

## Role System

Roles are **dynamic strings** - any value can be used. Common roles:
- `"learner"` - Default role for learners
- `"educator"` - For educators/teachers
- `"admin"` - For administrators
- `"custom-role"` - Any custom role string

The role is:
1. Set during authentication (via `role` parameter in request)
2. Stored in the user record
3. Included in the JWT token
4. Used by other services for authorization

## Preferred Language

The service supports preferred language:
1. **From Google**: Automatically retrieved from Google's `locale` field during OAuth
2. **Override**: Can be provided in the authentication request (`preferredLanguage` parameter)
3. **Update**: Can be updated via `PUT /auth/user/preferred-language` endpoint
4. **Storage**: Stored in user record in DynamoDB

**Language Code Format**: ISO 639-1 language codes (e.g., `"en"`, `"fr"`, `"es"`, `"de"`, `"ja"`)

**Priority**:
1. Explicit `preferredLanguage` in request (highest priority)
2. Google's `locale` from user profile
3. Existing user's `preferredLanguage` (if updating)

## User Events (SNS)

The service publishes user lifecycle events to an SNS topic when users are created or updated.

### Event Types

#### User Created Event

Published when a new user is created during authentication.

**Event Type**: `user.created`

**Payload**:
```json
{
  "type": "user.created",
  "payload": {
    "userId": "user-123456789",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/...",
    "role": "learner",
    "preferredLanguage": "en",
    "provider": "google",
    "providerId": "123456789",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "meta": {
    "eventId": "evt_1234567890_abc123",
    "occurredAt": "2024-01-01T00:00:00.000Z",
    "source": "auth-service"
  },
  "version": 1
}
```

#### User Updated Event

Published when a user's profile is updated (currently not implemented, but structure is ready).

**Event Type**: `user.updated`

### Subscribing to Events

To subscribe to user events:

1. **SQS Queue Subscription**:
   ```terraform
   resource "aws_sqs_queue" "user_events_queue" {
     name = "user-events-queue"
   }

   resource "aws_sns_topic_subscription" "user_events_sqs" {
     topic_arn = aws_sns_topic.user_events.arn
     protocol  = "sqs"
     endpoint  = aws_sqs_queue.user_events_queue.arn
   }
   ```

2. **Lambda Subscription**:
   ```terraform
   resource "aws_sns_topic_subscription" "user_events_lambda" {
     topic_arn = aws_sns_topic.user_events.arn
     protocol  = "lambda"
     endpoint  = aws_lambda_function.user_handler.arn
   }
   ```

3. **Email Subscription** (for testing):
   ```terraform
   resource "aws_sns_topic_subscription" "user_events_email" {
     topic_arn = aws_sns_topic.user_events.arn
     protocol  = "email"
     endpoint  = "admin@example.com"
   }
   ```

### Event Publishing

- Events are published asynchronously and failures are logged but don't fail the main authentication flow
- If `USER_EVENTS_TOPIC_ARN` is not set, the service will continue to work but events won't be published
- Events include `MessageAttributes` with `eventType` for filtering

## Conditional Build

The auth-service is **conditionally built and deployed** based on the `BUILD_AUTH_SERVICE` GitHub variable:

- **If `BUILD_AUTH_SERVICE = true`**: Service is built, packaged, and deployed
- **If `BUILD_AUTH_SERVICE != true` or not set**: Service is skipped

To enable:
1. Go to GitHub repository settings
2. Add repository variable: `BUILD_AUTH_SERVICE = true`
3. The next CI run will include auth-service

## Build and Deploy

```bash
# Build
npm run build

# Package
npm run package

# Deploy (via Terraform)
cd infra/services/auth-service
terraform init -backend-config=...
terraform apply
```

## Related Services

- **Access Service**: Uses JWT tokens generated by this service
- **Other Services**: All services that require authentication use JWT tokens from this service
