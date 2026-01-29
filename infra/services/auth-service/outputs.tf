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
