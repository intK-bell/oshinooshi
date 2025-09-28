variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment identifier"
}

variable "lambda_runtime" {
  type        = string
  description = "Lambda runtime"
  default     = "nodejs20.x"
}

variable "lambda_handler" {
  type        = string
  description = "Lambda handler"
  default     = "index.handler"
}

variable "lambda_package_bucket" {
  type        = string
  description = "S3 bucket containing Lambda deployment package"
}

variable "lambda_package_key" {
  type        = string
  description = "S3 key for Lambda deployment package"
}

variable "moderation_config_path" {
  type        = string
  description = "Path to moderation settings file"
  default     = "config/moderation-settings.yaml"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for CloudFront"
}


variable "discord_webhook_url" {
  type        = string
  description = "Discord incoming webhook URL for alerts"
  sensitive   = true
}

variable "sns_to_discord_package_key" {
  type        = string
  description = "S3 key for SNS-to-Discord lambda deployment package"
}

variable "discord_webhook_secret_arn" {
  type        = string
  description = "Secrets Manager ARN storing Discord webhook URL"
}
