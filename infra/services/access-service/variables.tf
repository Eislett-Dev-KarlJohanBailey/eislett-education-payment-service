variable "state_bucket_name" {
    type = string
}

variable "state_region" {
    type = string
}

variable "state_bucket_key" {
    type = string
}

variable "environment" {
    type = string
    default = "dev"
}

variable "jwt_access_token_secret" {
    type = string
    description = "JWT access token secret for verifying tokens"
    sensitive = true
}

variable "project_name" {
    type = string
    description = "Project name prefix for resource naming (e.g., 'eislett-education')"
    default = "eislett-education"
}
