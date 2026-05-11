# Powertranz Service

This service is the Powertranz payment service for this repo. It follows the same style as the Stripe service and uses API Gateway + Lambda.

## What it does

- Handles Powertranz routes
- Has a simple health route for smoke testing
- Uses the same build and package setup as the other services

## Current route

- `GET /powertranz/health`

## Run it

From the repo root:

```bash
npm run build --workspace=@services/powertranz-service
npm run package --workspace=@services/powertranz-service
npm run type-check --workspace=@services/powertranz-service
```

## Test it

Run the smoke test:

```bash
npx jest --config jest.e2e.config.js tests/e2e/powertranz-service.test.ts --runInBand
```

## Notes

- `src/` has the service code
- `dist/` is the build output
- `function.zip` is the packaged Lambda file

This service is still a skeleton, so more Powertranz payment logic can be added later.
