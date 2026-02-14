output "token_lambda_arn" {
  value       = module.token_service_lambda.function_arn
  description = "ARN of the token service Lambda function"
}

output "token_lambda_name" {
  value       = module.token_service_lambda.function_name
  description = "Name of the token service Lambda function"
}
