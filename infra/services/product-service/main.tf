terraform {
  backend "s3" {
    bucket = "eislett-education-product-service-state"
    key = "tf-infra/{var.environment}.tfstate"
    region = "us-east-1"
    dynamodb_table = "eislett-education-product-service-state-locking"
    encrypt = true
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

module "product_service_iam_role" {
  source = "../../modules/lambda_iam_role"

  role_name = "product-service-lambda-role-${var.environment}"
  
  dynamodb_table_arns = [
    "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/eislett-education-${var.environment}-products",
    "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/eislett-education-${var.environment}-products/index/*"
  ]

  tags = {
    Environment = var.environment
    Service     = "product-service"
  }
}

module "product_service_lambda" {
  source = "../../modules/lambda"

  function_name = "product-service"
  handler       = "handler/index.handler"
  runtime       = "nodejs20.x"
  filename      = "${path.root}/../../services/product-service/function.zip"
  iam_role_arn  = module.product_service_iam_role.role_arn

  environment_variables = {
    PRODUCTS_TABLE = "eislett-education-${var.environment}-products"
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