const LOCALSTACK_ENDPOINT = "http://localhost:4566";

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
