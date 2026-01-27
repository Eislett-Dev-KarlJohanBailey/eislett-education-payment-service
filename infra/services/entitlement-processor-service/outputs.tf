# Billing Events SNS Topic (Input)
output "billing_events_topic_arn" {
  value       = aws_sns_topic.billing_events.arn
  description = "ARN of the billing events SNS topic for other services to publish to"
}

output "billing_events_topic_name" {
  value       = aws_sns_topic.billing_events.name
  description = "Name of the billing events SNS topic"
}

# Entitlement Updates SNS Topic (Output)
output "entitlement_updates_topic_arn" {
  value       = aws_sns_topic.entitlement_updates.arn
  description = "ARN of the entitlement updates SNS topic for other services to subscribe to"
}

output "entitlement_updates_topic_name" {
  value       = aws_sns_topic.entitlement_updates.name
  description = "Name of the entitlement updates SNS topic"
}

# Processed Events Table
output "processed_events_table_name" {
  value       = aws_dynamodb_table.processed_events.name
  description = "Name of the processed events DynamoDB table (idempotency tracking)"
}

output "processed_events_table_arn" {
  value       = aws_dynamodb_table.processed_events.arn
  description = "ARN of the processed events DynamoDB table"
}

output "processed_events_table_details" {
  value = {
    name         = aws_dynamodb_table.processed_events.name
    arn          = aws_dynamodb_table.processed_events.arn
    id           = aws_dynamodb_table.processed_events.id
    hash_key     = aws_dynamodb_table.processed_events.hash_key
    billing_mode = aws_dynamodb_table.processed_events.billing_mode
  }
  description = "Complete details of the processed events DynamoDB table"
}

# SQS Queue
output "entitlement_processor_queue_url" {
  value       = aws_sqs_queue.entitlement_processor_queue.url
  description = "URL of the entitlement processor SQS queue"
}

output "entitlement_processor_queue_arn" {
  value       = aws_sqs_queue.entitlement_processor_queue.arn
  description = "ARN of the entitlement processor SQS queue"
}

# DLQ
output "entitlement_processor_dlq_url" {
  value       = aws_sqs_queue.entitlement_processor_dlq.url
  description = "URL of the entitlement processor dead letter queue"
}

output "entitlement_processor_dlq_arn" {
  value       = aws_sqs_queue.entitlement_processor_dlq.arn
  description = "ARN of the entitlement processor dead letter queue"
}
