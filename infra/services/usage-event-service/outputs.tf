output "usage_event_queue_url" {
  value       = aws_sqs_queue.usage_event_queue.url
  description = "URL of the usage event SQS queue (use this to send messages)"
}

output "usage_event_queue_arn" {
  value       = aws_sqs_queue.usage_event_queue.arn
  description = "ARN of the usage event SQS queue"
}

output "usage_event_dlq_arn" {
  value       = aws_sqs_queue.usage_event_dlq.arn
  description = "ARN of the usage event DLQ"
}

output "usage_logs_table_name" {
  value       = aws_dynamodb_table.usage_logs.name
  description = "Name of the DynamoDB table storing usage records"
}

output "usage_logs_table_arn" {
  value       = aws_dynamodb_table.usage_logs.arn
  description = "ARN of the DynamoDB table storing usage records"
}
