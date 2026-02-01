variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "handler" {
  description = "Lambda handler"
  type        = string
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
}

variable "filename" {
  description = "Path to the deployment package"
  type        = string
}

variable "iam_role_arn" {
  description = "ARN of the IAM role for the Lambda function"
  type        = string
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 3
}

variable "memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 128
}
