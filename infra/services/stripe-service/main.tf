terraform {
  backend "s3" {
    bucket         = "placeholder"
    key            = "placeholder"
    region         = "us-east-1"
    dynamodb_table = "placeholder"
    encrypt        = true
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

provider "aws" {
  region = "us-east-1"
}

data "terraform_remote_state" "foundation" {
  backend = "s3"

  config = {
    bucket = var.state_bucket_name
    key    = var.state_bucket_key
    region = var.state_region
  }
}

data "terraform_remote_state" "product_service" {
  backend = "s3"

  config = {
    bucket = "${var.project_name}-${var.environment}-product-service-state"
    key    = "tf-infra/${var.environment}.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "pricing_service" {
  backend = "s3"

  config = {
    bucket = "${var.project_name}-${var.environment}-pricing-service-state"
    key    = "tf-infra/${var.environment}.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "entitlement_processor_service" {
  backend = "s3"

  config = {
    bucket = "${var.project_name}-${var.environment}-entitlement-processor-service-state"
    key    = "tf-infra/${var.environment}.tfstate"
    region = "us-east-1"
  }
}

# Get Stripe secrets from AWS Secrets Manager
data "aws_secretsmanager_secret" "stripe_secret_key" {
  name = "${var.project_name}-${var.environment}-stripe-secret-key"
}

data "aws_secretsmanager_secret_version" "stripe_secret_key" {
  secret_id = data.aws_secretsmanager_secret.stripe_secret_key.id
}

data "aws_secretsmanager_secret" "stripe_webhook_secret" {
  name = "${var.project_name}-${var.environment}-stripe-webhook-secret"
}

data "aws_secretsmanager_secret_version" "stripe_webhook_secret" {
  secret_id = data.aws_secretsmanager_secret.stripe_webhook_secret.id
}

data "aws_secretsmanager_secret" "jwt_access_token_secret" {
  name = "${var.project_name}-${var.environment}-jwt-access-token-secret"
}

data "aws_secretsmanager_secret_version" "jwt_access_token_secret" {
  secret_id = data.aws_secretsmanager_secret.jwt_access_token_secret.id
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Parse secrets - handle both JSON and plain string formats
locals {
  stripe_secret_key = try(
    jsondecode(data.aws_secretsmanager_secret_version.stripe_secret_key.secret_string)["key"],
    data.aws_secretsmanager_secret_version.stripe_secret_key.secret_string
  )
  stripe_webhook_secret = try(
    jsondecode(data.aws_secretsmanager_secret_version.stripe_webhook_secret.secret_string)["key"],
    data.aws_secretsmanager_secret_version.stripe_webhook_secret.secret_string
  )
  jwt_access_token_secret = try(
    jsondecode(data.aws_secretsmanager_secret_version.jwt_access_token_secret.secret_string)["key"],
    data.aws_secretsmanager_secret_version.jwt_access_token_secret.secret_string
  )
}

# DynamoDB Table for Stripe Customers
resource "aws_dynamodb_table" "stripe_customers" {
  name         = "${var.project_name}-${var.environment}-stripe-customers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "stripeCustomerId"
    type = "S"
  }

  global_secondary_index {
    name            = "stripeCustomerId-index"
    hash_key        = "stripeCustomerId"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Service     = "stripe-service"
    Name        = "Stripe Customers Table"
  }
}

# DynamoDB Table for Webhook Idempotency
resource "aws_dynamodb_table" "webhook_idempotency" {
  name         = "${var.project_name}-${var.environment}-stripe-webhook-idempotency"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "eventId"

  attribute {
    name = "eventId"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled         = true
  }

  tags = {
    Environment = var.environment
    Service     = "stripe-service"
    Name        = "Webhook Idempotency Table"
  }
}

# IAM Role for Stripe Service Lambda
module "stripe_service_iam_role" {
  source = "../../modules/lambda_iam_role"

  role_name = "stripe-service-lambda-role-${var.environment}"

  dynamodb_table_arns = [
    aws_dynamodb_table.stripe_customers.arn,
    "${aws_dynamodb_table.stripe_customers.arn}/index/*",
    aws_dynamodb_table.webhook_idempotency.arn,
    data.terraform_remote_state.product_service.outputs.products_table_arn,
    "${data.terraform_remote_state.product_service.outputs.products_table_arn}/index/*",
    data.terraform_remote_state.pricing_service.outputs.prices_table_arn,
    "${data.terraform_remote_state.pricing_service.outputs.prices_table_arn}/index/*",
  ]

  tags = {
    Environment = var.environment
    Service     = "stripe-service"
  }
}

# Additional IAM Policy for SNS Publishing
resource "aws_iam_role_policy" "sns_publish" {
  name = "stripe-service-sns-publish-${var.environment}"
  role = module.stripe_service_iam_role.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = data.terraform_remote_state.entitlement_processor_service.outputs.billing_events_topic_arn
      }
    ]
  })
}

# Additional IAM Policy for Secrets Manager
resource "aws_iam_role_policy" "secrets_manager" {
  name = "stripe-service-secrets-manager-${var.environment}"
  role = module.stripe_service_iam_role.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          data.aws_secretsmanager_secret.stripe_secret_key.arn,
          data.aws_secretsmanager_secret.stripe_webhook_secret.arn,
          data.aws_secretsmanager_secret.jwt_access_token_secret.arn,
        ]
      }
    ]
  })
}

# Lambda Function
module "stripe_service_lambda" {
  source = "../../modules/lambda"

  function_name = "stripe-service"
  handler       = "dist/handler/index.handler"
  runtime       = "nodejs20.x"
  filename      = abspath("${path.cwd}/services/stripe-service/function.zip")
  iam_role_arn  = module.stripe_service_iam_role.role_arn

  environment_variables = {
    STRIPE_SECRET_KEY              = local.stripe_secret_key
    STRIPE_WEBHOOK_SECRET          = local.stripe_webhook_secret
    STRIPE_CUSTOMERS_TABLE         = aws_dynamodb_table.stripe_customers.name
    WEBHOOK_IDEMPOTENCY_TABLE      = aws_dynamodb_table.webhook_idempotency.name
    PRODUCTS_TABLE                 = data.terraform_remote_state.product_service.outputs.products_table_name
    PRICES_TABLE                   = data.terraform_remote_state.pricing_service.outputs.prices_table_name
    BILLING_EVENTS_TOPIC_ARN       = data.terraform_remote_state.entitlement_processor_service.outputs.billing_events_topic_arn
    JWT_ACCESS_TOKEN_SECRET        = local.jwt_access_token_secret
  }
}

# API Gateway Integration
module "lambda_api_link" {
  source = "../../modules/lambda_api_link"
  api_gateway_id      = data.terraform_remote_state.foundation.outputs.api_gateway_id
  api_gateway_root_id = data.terraform_remote_state.foundation.outputs.api_gateway_root_id
  lambda_function_arn  = module.stripe_service_lambda.function_arn
  lambda_function_name = module.stripe_service_lambda.function_name
  paths = ["stripe"]
}

resource "aws_api_gateway_deployment" "deployment" {
  rest_api_id = data.terraform_remote_state.foundation.outputs.api_gateway_id
    
  depends_on = [module.lambda_api_link]
}
