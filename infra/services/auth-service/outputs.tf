output "users_table_name" {
  value       = aws_dynamodb_table.users.name
  description = "Name of the users DynamoDB table"
}

output "users_table_arn" {
  value       = aws_dynamodb_table.users.arn
  description = "ARN of the users DynamoDB table"
}

output "authentications_table_name" {
  value       = aws_dynamodb_table.authentications.name
  description = "Name of the authentications DynamoDB table"
}

output "authentications_table_arn" {
  value       = aws_dynamodb_table.authentications.arn
  description = "ARN of the authentications DynamoDB table"
}

output "user_events_topic_arn" {
  description = "ARN of the SNS topic for user events"
  value       = aws_sns_topic.user_events.arn
}

output "user_events_topic_name" {
  description = "Name of the SNS topic for user events"
  value       = aws_sns_topic.user_events.name
}
