output "photo_bucket_name" {
  value       = aws_s3_bucket.photo.bucket
  description = "Photo storage bucket"
}

output "photo_distribution_id" {
  value       = aws_cloudfront_distribution.photo.id
  description = "CloudFront distribution ID"
}

output "photo_processor_lambda_arn" {
  value       = aws_lambda_function.photo_processor.arn
  description = "Photo processor Lambda ARN"
}

output "photo_intake_queue_url" {
  value       = aws_sqs_queue.photo_intake.id
  description = "SQS URL for photo intake queue"
}

output "photo_intake_dlq_url" {
  value       = aws_sqs_queue.photo_dlq.id
  description = "SQS URL for photo DLQ"
}

output "post_media_table_name" {
  value       = aws_dynamodb_table.post_media.name
  description = "DynamoDB table for post media"
}

output "moderation_override_table_name" {
  value       = aws_dynamodb_table.moderation_override.name
  description = "DynamoDB table for moderation overrides"
}

output "event_bus_name" {
  value       = aws_cloudwatch_event_bus.app.name
  description = "EventBridge bus name"
}

output "notify_in_app_topic_arn" {
  value       = aws_sns_topic.notify_in_app.arn
  description = "SNS topic ARN for in-app notifications"
}

output "notify_line_topic_arn" {
  value       = aws_sns_topic.notify_line.arn
  description = "SNS topic ARN for LINE notifications"
}

output "profile_readiness_table_name" {
  value       = aws_dynamodb_table.profile_readiness.name
  description = "DynamoDB table for profile readiness status"
}

output "profile_readiness_writer_function_arn" {
  value       = aws_lambda_function.profile_readiness_writer.arn
  description = "Lambda function ARN for profile readiness writer"
}
