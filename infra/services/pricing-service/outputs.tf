output "prices_table_name" {
  value       = aws_dynamodb_table.prices.name
  description = "Name of the prices DynamoDB table"
}

output "prices_table_arn" {
  value       = aws_dynamodb_table.prices.arn
  description = "ARN of the prices DynamoDB table"
}

output "prices_table_id" {
  value       = aws_dynamodb_table.prices.id
  description = "ID of the prices DynamoDB table"
}

output "prices_table_details" {
  value = {
    name         = aws_dynamodb_table.prices.name
    arn          = aws_dynamodb_table.prices.arn
    id           = aws_dynamodb_table.prices.id
    hash_key     = aws_dynamodb_table.prices.hash_key
    range_key    = aws_dynamodb_table.prices.range_key
    billing_mode = aws_dynamodb_table.prices.billing_mode
  }
  description = "Complete details of the prices DynamoDB table for use by other services"
}

output "lambda_function_arn" {
  value       = module.pricing_service_lambda.function_arn
  description = "ARN of the pricing service Lambda function"
}

output "lambda_function_name" {
  value       = module.pricing_service_lambda.function_name
  description = "Name of the pricing service Lambda function"
}
