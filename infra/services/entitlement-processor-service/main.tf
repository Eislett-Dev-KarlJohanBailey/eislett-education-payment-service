terraform {
  backend "s3" {
    # Backend configuration is provided via -backend-config flags during terraform init
    # to support dynamic environment-based naming: eislett-education-[environment]-[service-name]-...
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

data "terraform_remote_state" "product_service" {
  backend = "s3"

  config = {
    bucket = "eislett-education-${var.environment}-product-service-state"
    key    = "tf-infra/${var.environment}.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "access_service" {
  backend = "s3"

  config = {
    bucket = "eislett-education-${var.environment}-access-service-state"
    key    = "tf-infra/${var.environment}.tfstate"
    region = "us-east-1"
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# SNS Topic for Billing Events (Input)
resource "aws_sns_topic" "billing_events" {
  name = "eislett-education-${var.environment}-billing-events"

  tags = {
    Environment = var.environment
    Service     = "entitlement-processor-service"
    Name        = "Billing Events Topic"
  }
}

# SNS Topic for Entitlement Updates (Output)
resource "aws_sns_topic" "entitlement_updates" {
  name = "eislett-education-${var.environment}-entitlement-updates"

  tags = {
    Environment = var.environment
    Service     = "entitlement-processor-service"
    Name        = "Entitlement Updates Topic"
  }
}

# SQS Dead Letter Queue
resource "aws_sqs_queue" "entitlement_processor_dlq" {
  name = "eislett-education-${var.environment}-entitlement-processor-dlq"

  tags = {
    Environment = var.environment
    Service     = "entitlement-processor-service"
    Name        = "Entitlement Processor DLQ"
  }
}

# SQS Queue for Entitlement Processor
resource "aws_sqs_queue" "entitlement_processor_queue" {
  name                       = "eislett-education-${var.environment}-entitlement-processor-queue"
  visibility_timeout_seconds = 300  # 5 minutes
  message_retention_seconds  = 1209600  # 14 days
  receive_wait_time_seconds  = 20  # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.entitlement_processor_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = var.environment
    Service     = "entitlement-processor-service"
    Name        = "Entitlement Processor Queue"
  }
}

# SQS Queue Policy to allow SNS to send messages
resource "aws_sqs_queue_policy" "entitlement_processor_queue_policy" {
  queue_url = aws_sqs_queue.entitlement_processor_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.entitlement_processor_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.billing_events.arn
          }
        }
      }
    ]
  })
}

# SNS Subscription: SQS Queue subscribes to Billing Events Topic
resource "aws_sns_topic_subscription" "billing_events_to_sqs" {
  topic_arn = aws_sns_topic.billing_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.entitlement_processor_queue.arn
}

# DynamoDB Table for Processed Events (Idempotency)
resource "aws_dynamodb_table" "processed_events" {
  name         = "eislett-education-${var.environment}-entitlement-processor-events"
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
    Service     = "entitlement-processor-service"
    Name        = "Processed Events Table"
  }
}

# IAM Role for Entitlement Processor Lambda
module "entitlement_processor_iam_role" {
  source = "../../modules/lambda_iam_role"

  role_name = "entitlement-processor-lambda-role-${var.environment}"

  # DynamoDB permissions
  dynamodb_table_arns = [
    data.terraform_remote_state.product_service.outputs.products_table_arn,
    "${data.terraform_remote_state.product_service.outputs.products_table_arn}/index/*",
    data.terraform_remote_state.access_service.outputs.entitlements_table_arn,
    "${data.terraform_remote_state.access_service.outputs.entitlements_table_arn}/index/*",
    aws_dynamodb_table.processed_events.arn
  ]

  tags = {
    Environment = var.environment
    Service     = "entitlement-processor-service"
  }
}

# Additional IAM Policy for SNS Publishing
resource "aws_iam_role_policy" "sns_publish" {
  name = "entitlement-processor-sns-publish-${var.environment}"
  role = module.entitlement_processor_iam_role.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.entitlement_updates.arn
      }
    ]
  })
}

# Additional IAM Policy for SQS
resource "aws_iam_role_policy" "sqs_access" {
  name = "entitlement-processor-sqs-access-${var.environment}"
  role = module.entitlement_processor_iam_role.role_name

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
        Resource = aws_sqs_queue.entitlement_processor_queue.arn
      }
    ]
  })
}

# Lambda Function
module "entitlement_processor_lambda" {
  source = "../../modules/lambda"

  function_name = "entitlement-processor"
  handler       = "dist/handler/index.handler"
  runtime       = "nodejs20.x"
  filename      = abspath("${path.cwd}/services/entitlement-processor-service/function.zip")
  iam_role_arn  = module.entitlement_processor_iam_role.role_arn

  environment_variables = {
    PRODUCTS_TABLE                = data.terraform_remote_state.product_service.outputs.products_table_name
    ENTITLEMENTS_TABLE            = data.terraform_remote_state.access_service.outputs.entitlements_table_name
    PROCESSED_EVENTS_TABLE        = aws_dynamodb_table.processed_events.name
    ENTITLEMENT_UPDATES_TOPIC_ARN = aws_sns_topic.entitlement_updates.arn
  }
}

# Lambda Event Source Mapping (SQS Trigger)
resource "aws_lambda_event_source_mapping" "entitlement_processor_sqs_trigger" {
  event_source_arn = aws_sqs_queue.entitlement_processor_queue.arn
  function_name    = module.entitlement_processor_lambda.function_arn
  batch_size       = 10
  maximum_batching_window_in_seconds = 5

  # Enable partial batch response for DLQ handling
  function_response_types = ["ReportBatchItemFailures"]
}
