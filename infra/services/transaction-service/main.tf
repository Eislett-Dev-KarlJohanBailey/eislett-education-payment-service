terraform {
  backend "s3" {
    # Backend configuration is provided via -backend-config flags during terraform init
    # to support dynamic environment-based naming: [project-name]-[environment]-[service-name]-...
    bucket         = "placeholder" # Set via -backend-config
    key            = "placeholder" # Set via -backend-config
    region         = "us-east-1"   # Set via -backend-config
    dynamodb_table = "placeholder" # Set via -backend-config
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

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Get JWT secret from AWS Secrets Manager
data "aws_secretsmanager_secret" "jwt_access_token_secret" {
  name = "${var.project_name}-${var.environment}-jwt-access-token-secret"
}

data "aws_secretsmanager_secret_version" "jwt_access_token_secret" {
  secret_id = data.aws_secretsmanager_secret.jwt_access_token_secret.id
}

locals {
  jwt_access_token_secret = try(
    jsondecode(data.aws_secretsmanager_secret_version.jwt_access_token_secret.secret_string)["key"],
    data.aws_secretsmanager_secret_version.jwt_access_token_secret.secret_string
  )
}

# Look up billing events SNS topic by name (created by stripe-service or entitlement-service)
data "aws_sns_topic" "billing_events" {
  name = "${var.project_name}-${var.environment}-billing-events"
}

# DynamoDB Table for Transactions
resource "aws_dynamodb_table" "transactions" {
  name         = "${var.project_name}-${var.environment}-transactions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Service     = "transaction-service"
    Name        = "Transactions Table"
  }
}

# SQS Dead Letter Queue
resource "aws_sqs_queue" "transaction_dlq" {
  name = "${var.project_name}-${var.environment}-transaction-dlq"

  tags = {
    Environment = var.environment
    Service     = "transaction-service"
    Name        = "Transaction DLQ"
  }
}

# SQS Queue for Transaction Service (with batch size of 20)
resource "aws_sqs_queue" "transaction_queue" {
  name                       = "${var.project_name}-${var.environment}-transaction-queue"
  visibility_timeout_seconds = 300  # 5 minutes
  message_retention_seconds  = 1209600  # 14 days
  receive_wait_time_seconds  = 20  # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.transaction_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
    Service     = "transaction-service"
    Name        = "Transaction Queue"
  }
}

# SQS Queue Policy to allow SNS to send messages
resource "aws_sqs_queue_policy" "transaction_queue_policy" {
  queue_url = aws_sqs_queue.transaction_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.transaction_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = data.aws_sns_topic.billing_events.arn
          }
        }
      }
    ]
  })
}

# SNS Subscription: SQS Queue subscribes to Billing Events Topic
resource "aws_sns_topic_subscription" "billing_events_to_sqs" {
  topic_arn = data.aws_sns_topic.billing_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.transaction_queue.arn
}

module "transaction_service_iam_role" {
  source = "../../modules/lambda_iam_role"

  role_name = "transaction-service-lambda-role-${var.environment}"
  
  # DynamoDB permissions for transactions table
  dynamodb_table_arns = [
    aws_dynamodb_table.transactions.arn,
    "${aws_dynamodb_table.transactions.arn}/index/*"
  ]

  tags = {
    Environment = var.environment
    Service     = "transaction-service"
  }
}

# Additional IAM Policy for SQS access
resource "aws_iam_role_policy" "sqs_access" {
  name = "transaction-service-sqs-access-${var.environment}"
  role = module.transaction_service_iam_role.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.transaction_queue.arn,
          aws_sqs_queue.transaction_dlq.arn
        ]
      }
    ]
  })
}

# Additional IAM Policy for Secrets Manager (for JWT)
resource "aws_iam_role_policy" "secrets_manager" {
  name = "transaction-service-secrets-manager-${var.environment}"
  role = module.transaction_service_iam_role.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          data.aws_secretsmanager_secret.jwt_access_token_secret.arn
        ]
      }
    ]
  })
}

# Lambda Function for SQS Handler (batch processing)
module "transaction_lambda" {
  source = "../../modules/lambda"

  function_name = "transaction-service"
  handler       = "dist/handler/index.handler"
  runtime       = "nodejs20.x"
  filename      = abspath("${path.cwd}/services/transaction-service/function.zip")
  iam_role_arn  = module.transaction_service_iam_role.role_arn

  environment_variables = {
    TRANSACTIONS_TABLE = aws_dynamodb_table.transactions.name
  }
}

# Lambda Function for API Gateway Handler
module "transaction_api_lambda" {
  source = "../../modules/lambda"

  function_name = "transaction-service-api"
  handler       = "dist/api-gateway.handler"
  runtime       = "nodejs20.x"
  filename      = abspath("${path.cwd}/services/transaction-service/function.zip")
  iam_role_arn  = module.transaction_service_iam_role.role_arn

  environment_variables = {
    TRANSACTIONS_TABLE      = aws_dynamodb_table.transactions.name
    JWT_ACCESS_TOKEN_SECRET = local.jwt_access_token_secret
  }
}

# SQS Event Source Mapping (with batch size of 20)
resource "aws_lambda_event_source_mapping" "transaction_queue_mapping" {
  event_source_arn = aws_sqs_queue.transaction_queue.arn
  function_name    = module.transaction_lambda.function_arn
  batch_size        = 20  # Process up to 20 messages at a time
  maximum_batching_window_in_seconds = 5  # Wait up to 5 seconds to batch

  # Enable partial batch response for DLQ handling
  function_response_types = ["ReportBatchItemFailures"]
}

module "lambda_api_link" {
  source = "../../modules/lambda_api_link"
  api_gateway_id      = data.terraform_remote_state.foundation.outputs.api_gateway_id
  api_gateway_root_id = data.terraform_remote_state.foundation.outputs.api_gateway_root_id
  lambda_function_arn  = module.transaction_api_lambda.function_arn
  lambda_function_name = module.transaction_api_lambda.function_name
  paths = ["transactions"]
}

resource "aws_api_gateway_deployment" "deployment" {
  rest_api_id = data.terraform_remote_state.foundation.outputs.api_gateway_id
    
  depends_on = [module.lambda_api_link]
}
