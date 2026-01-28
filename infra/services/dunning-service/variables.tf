variable "project_name" {
  type        = string
  description = "Project name prefix for resource naming (e.g., 'eislett-education')"
  default     = "eislett-education"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g., 'dev', 'staging', 'prod')"
}

variable "state_bucket_name" {
  type        = string
  description = "S3 bucket name for Terraform state"
}

variable "state_bucket_key" {
  type        = string
  description = "S3 key for Terraform state"
}

variable "state_region" {
  type        = string
  description = "AWS region for Terraform state"
  default     = "us-east-1"
}
