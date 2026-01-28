output "trials_table_name" {
  value       = aws_dynamodb_table.trials.name
  description = "Name of the trials DynamoDB table"
}

output "trials_table_arn" {
  value       = aws_dynamodb_table.trials.arn
  description = "ARN of the trials DynamoDB table"
}

output "trials_table_id" {
  value       = aws_dynamodb_table.trials.id
  description = "ID of the trials DynamoDB table"
}

output "trial_lambda_arn" {
  value       = module.trial_service_lambda.function_arn
  description = "ARN of the trial service Lambda function"
}

output "trial_lambda_name" {
  value       = module.trial_service_lambda.function_name
  description = "Name of the trial service Lambda function"
}
