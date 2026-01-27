output "stripe_customers_table_name" {
  value       = aws_dynamodb_table.stripe_customers.name
  description = "Name of the Stripe customers DynamoDB table"
}

output "stripe_customers_table_arn" {
  value       = aws_dynamodb_table.stripe_customers.arn
  description = "ARN of the Stripe customers DynamoDB table"
}

output "webhook_idempotency_table_name" {
  value       = aws_dynamodb_table.webhook_idempotency.name
  description = "Name of the webhook idempotency DynamoDB table"
}

output "webhook_idempotency_table_arn" {
  value       = aws_dynamodb_table.webhook_idempotency.arn
  description = "ARN of the webhook idempotency DynamoDB table"
}

output "lambda_function_arn" {
  value       = module.stripe_service_lambda.function_arn
  description = "ARN of the Stripe service Lambda function"
}

output "lambda_function_name" {
  value       = module.stripe_service_lambda.function_name
  description = "Name of the Stripe service Lambda function"
}
