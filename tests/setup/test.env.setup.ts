import fs from "node:fs";
import path from "node:path";

const LOCALSTACK_ENDPOINT = "http://localhost:4566";

function loadDotEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[name] === undefined || process.env[name] === "") {
      process.env[name] = value;
    }
  }
}

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "services/powertranz-service/.env"),
  path.resolve(process.cwd(), "services/powertranz-service/.env.local"),
  path.resolve(process.cwd(), ".env.local"),
];

for (const candidate of envCandidates) {
  loadDotEnvFile(candidate);
}

process.env.NODE_ENV = "test";

process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test";
process.env.AWS_SECRET_ACCESS_KEY = "test";
process.env.AWS_ENDPOINT = LOCALSTACK_ENDPOINT;
process.env.LOCALSTACK_ENDPOINT = LOCALSTACK_ENDPOINT;
process.env.AWS_ENDPOINT_URL = LOCALSTACK_ENDPOINT;
process.env.ENVIRONMENT = "test";
process.env.ENTITLEMENTS_TABLE = "entitlements-test";
process.env.PRICES_TABLE = "prices-test";
process.env.PRODUCTS_TABLE = "products-test";
