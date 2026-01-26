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
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.25.0"
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

# Note: Entitlements table should already exist from another service
# If it doesn't exist, it should be created in the entitlement-service or foundation
# For now, we'll reference it by name pattern

module "access_service_iam_role" {
  source = "../../modules/lambda_iam_role"

  role_name = "access-service-lambda-role-${var.environment}"
  
  # DynamoDB permissions for entitlements table
  # Assuming entitlements table follows naming: eislett-education-{environment}-entitlements
  dynamodb_table_arns = [
    "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/eislett-education-${var.environment}-entitlements",
    "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/eislett-education-${var.environment}-entitlements/index/*"
  ]

  tags = {
    Environment = var.environment
    Service     = "access-service"
  }
}

module "access_service_lambda" {
  source = "../../modules/lambda"

  function_name = "access-service"
  handler       = "dist/handler/index.handler"
  runtime       = "nodejs20.x"
  filename      = abspath("${path.cwd}/services/access-service/function.zip")
  iam_role_arn  = module.access_service_iam_role.role_arn

  environment_variables = {
    ENTITLEMENTS_TABLE      = "eislett-education-${var.environment}-entitlements"
    JWT_ACCESS_TOKEN_SECRET = var.jwt_access_token_secret
  }
}

module "lambda_api_link" {
  source = "../../modules/lambda_api_link"
  api_gateway_id      = data.terraform_remote_state.foundation.outputs.api_gateway_id
  api_gateway_root_id = data.terraform_remote_state.foundation.outputs.api_gateway_root_id
  lambda_function_arn  = module.access_service_lambda.function_arn
  lambda_function_name = module.access_service_lambda.function_name
  paths = ["access"]
}

resource "aws_api_gateway_deployment" "deployment" {
  rest_api_id = data.terraform_remote_state.foundation.outputs.api_gateway_id
    
  depends_on = [module.lambda_api_link]
}
