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

# DynamoDB Table for Products
resource "aws_dynamodb_table" "products" {
  name         = "${var.project_name}-${var.environment}-products"
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

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Service     = "product-service"
    Name        = "Products Table"
  }
}

module "product_service_iam_role" {
  source = "../../modules/lambda_iam_role"

  role_name = "product-service-lambda-role-${var.environment}"
  
  dynamodb_table_arns = [
    aws_dynamodb_table.products.arn,
    "${aws_dynamodb_table.products.arn}/index/*"
  ]

  tags = {
    Environment = var.environment
    Service     = "product-service"
  }
}

module "product_service_lambda" {
  source = "../../modules/lambda"

  function_name = "product-service"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  filename      = abspath("${path.cwd}/services/product-service/function.zip")
  iam_role_arn  = module.product_service_iam_role.role_arn

  environment_variables = {
    PRODUCTS_TABLE = aws_dynamodb_table.products.name
  }
}

module "lambda_api_link" {
  source = "../../modules/lambda_api_link"
  api_gateway_id      = data.terraform_remote_state.foundation.outputs.api_gateway_id
  api_gateway_root_id = data.terraform_remote_state.foundation.outputs.api_gateway_root_id
  lambda_function_arn  = module.product_service_lambda.function_arn
  lambda_function_name = module.product_service_lambda.function_name
  paths = ["products"]
}

resource "aws_api_gateway_deployment" "deployment" {
  rest_api_id = data.terraform_remote_state.foundation.outputs.api_gateway_id
    
  depends_on = [module.lambda_api_link]
}