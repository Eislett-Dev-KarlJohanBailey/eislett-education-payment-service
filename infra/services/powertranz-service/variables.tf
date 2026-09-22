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
  type    = string
  default = "dev"
}

variable "project_name" {
  type        = string
  description = "Project name prefix for resource naming (e.g., 'eislett-education')"
  default     = "eislett-education"
}

variable "powertranz_base_url" {
  type        = string
  description = "PowerTranz API base URL for the selected environment"
  default     = "https://gateway.ptranz.com"
}

variable "powertranz_hpp_page_set" {
  type        = string
  description = "Optional PowerTranz hosted page PageSet"
  default     = "Eislett"
}

variable "powertranz_hpp_page_name" {
  type        = string
  description = "Optional PowerTranz hosted page PageName"
  default     = "Payment"
}

variable "usd_ttd_exchange_rate" {
  type        = number
  description = "Exchange rate used to convert USD pricing to TTD for PowerTranz"
  default     = 6.8
}
