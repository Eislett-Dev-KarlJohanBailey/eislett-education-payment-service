output "dunning_table_name" {
  description = "Name of the Dunning DynamoDB table"
  value       = aws_dynamodb_table.dunning.name
}

output "dunning_table_arn" {
  description = "ARN of the Dunning DynamoDB table"
  value       = aws_dynamodb_table.dunning.arn
}

output "dunning_queue_url" {
  description = "URL of the Dunning SQS queue"
  value       = aws_sqs_queue.dunning_queue.url
}

output "dunning_queue_arn" {
  description = "ARN of the Dunning SQS queue"
  value       = aws_sqs_queue.dunning_queue.arn
}

output "dunning_lambda_arn" {
  description = "ARN of the Dunning Lambda function (SQS handler)"
  value       = module.dunning_lambda.function_arn
}

output "dunning_api_lambda_arn" {
  description = "ARN of the Dunning API Lambda function"
  value       = module.dunning_api_lambda.function_arn
}
