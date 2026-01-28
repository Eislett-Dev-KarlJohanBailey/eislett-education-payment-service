output "transactions_table_name" {
  value       = aws_dynamodb_table.transactions.name
  description = "Name of the transactions DynamoDB table"
}

output "transactions_table_arn" {
  value       = aws_dynamodb_table.transactions.arn
  description = "ARN of the transactions DynamoDB table"
}

output "transaction_queue_arn" {
  value       = aws_sqs_queue.transaction_queue.arn
  description = "ARN of the transaction service SQS queue"
}

output "transaction_dlq_arn" {
  value       = aws_sqs_queue.transaction_dlq.arn
  description = "ARN of the transaction service DLQ"
}
