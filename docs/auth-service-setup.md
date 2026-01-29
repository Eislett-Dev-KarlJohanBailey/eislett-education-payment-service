# Auth Service Setup Guide

This guide explains how to set up and configure the auth-service for Google OAuth authentication.

## Prerequisites

1. **Google Cloud Console Setup**:
   - Create a Google Cloud project
   - Enable Google+ API
   - Create OAuth 2.0 Client ID credentials
   - Note your `clientId`, `clientSecret`, and configure `redirectUri`

2. **AWS Secrets Manager**:
   - Create secrets for JWT and Google OAuth (see below)

3. **GitHub Variable**:
   - Set `BUILD_AUTH_SERVICE = true` in repository variables to enable the service

## Secrets Configuration

### 1. JWT Access Token Secret

**Secret Name**: `{project-name}-{environment}-jwt-access-token-secret`

**Format**: Plain string or JSON
```json
{
  "key": "your-jwt-secret-key-here"
}
```

**Create**:
```bash
aws secretsmanager create-secret \
  --name "eislett-education-dev-jwt-access-token-secret" \
  --secret-string "your-jwt-secret-key-here" \
  --region us-east-1
```

### 2. Google OAuth Secret

**Secret Name**: `{project-name}-{environment}-google-oauth-secret`

**Format**: JSON with Google OAuth credentials
```json
{
  "clientId": "your-client-id.apps.googleusercontent.com",
  "clientSecret": "your-client-secret",
  "redirectUri": "https://your-domain.com/auth/google/callback"
}
```

**Create**:
```bash
aws secretsmanager create-secret \
  --name "eislett-education-dev-google-oauth-secret" \
  --secret-string '{"clientId":"...","clientSecret":"...","redirectUri":"..."}' \
  --region us-east-1
```

## Enabling the Service

### GitHub Repository Variable

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions** → **Variables**
3. Add a new variable:
   - **Name**: `BUILD_AUTH_SERVICE`
   - **Value**: `true`
4. Save

### What This Does

When `BUILD_AUTH_SERVICE = true`:
- ✅ Service is built during CI
- ✅ Service is packaged
- ✅ Terraform backend is bootstrapped
- ✅ Service is deployed to AWS

When `BUILD_AUTH_SERVICE != true` or not set:
- ❌ Service is skipped in build
- ❌ Service is skipped in package
- ❌ Service is skipped in deployment

## Frontend Integration

### Step 1: Redirect to Google OAuth

```javascript
const clientId = "your-google-client-id";
const redirectUri = "https://your-domain.com/auth/google/callback";
const scope = "email profile";

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

window.location.href = authUrl;
```

### Step 2: Handle OAuth Callback

After Google redirects back with a `code`:

```javascript
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code) {
  // Exchange code for JWT token
  const response = await fetch('https://api.your-domain.com/auth/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: code,
      role: 'learner' // Optional: any role string
    })
  });

  const { token, user } = await response.json();
  
  // Store token
  localStorage.setItem('authToken', token);
  
  // Use token for authenticated requests
  // Authorization: Bearer <token>
}
```

## API Endpoint

### POST /auth/google

**Request**:
```json
{
  "code": "4/0A...",  // OAuth authorization code
  "role": "learner"    // Optional: defaults to "learner"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "user-123456789",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://...",
    "role": "learner"
  }
}
```

## DynamoDB Tables

The service creates two DynamoDB tables:

1. **Users Table**: `{project-name}-{environment}-users`
   - Stores user profiles
   - GSI on `googleId` for lookup

2. **Authentications Table**: `{project-name}-{environment}-authentications`
   - Stores OAuth tokens and login sessions
   - Tracks authentication history

## Role System

Roles are **dynamic strings** - you can use any value:
- `"learner"` - Default
- `"educator"` - For teachers
- `"admin"` - For administrators
- `"custom-role"` - Any custom role

The role is:
- Set during authentication (via request body)
- Stored in user record
- Included in JWT token
- Used by other services for authorization

## Testing

1. **Enable the service**: Set `BUILD_AUTH_SERVICE = true`
2. **Create secrets**: Set up JWT and Google OAuth secrets
3. **Deploy**: CI will automatically deploy
4. **Test OAuth flow**: Use frontend to test Google authentication

## Troubleshooting

### Service not building
- Check `BUILD_AUTH_SERVICE` variable is set to `true`
- Check CI logs for build errors

### Authentication fails
- Verify Google OAuth secret is correct
- Check redirect URI matches Google Console configuration
- Verify JWT secret exists in Secrets Manager

### User not found
- Check DynamoDB tables are created
- Verify GSI is properly configured
- Check CloudWatch logs for errors
