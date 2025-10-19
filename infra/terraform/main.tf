terraform {
  required_version = ">= 1.5.0"
  backend "s3" {}
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  app_name = "oshinooshi"
  env      = var.environment
  tags = {
    Application = local.app_name
    Environment = local.env
  }
}

resource "random_id" "photo_bucket" {
  byte_length = 2
}

# --------------------
# S3 for photo storage
# --------------------
resource "aws_s3_bucket" "photo" {
  bucket = "${local.app_name}-photo-${local.env}-${random_id.photo_bucket.hex}"

  lifecycle {
    prevent_destroy = true
  }

  tags = local.tags
}

resource "aws_s3_bucket_lifecycle_configuration" "photo" {
  bucket = aws_s3_bucket.photo.id

  lifecycle {
    prevent_destroy = true
  }

  rule {
    id     = "transient"
    status = "Enabled"

    filter {
      prefix = "transient/drafts/"
    }

    expiration {
      days = 1
    }
  }

  rule {
    id     = "archive"
    status = "Enabled"

    filter {
      prefix = "protected/archives/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER_IR"
    }

    expiration {
      days = 730
    }
  }
}

resource "aws_s3_bucket_versioning" "photo" {
  bucket = aws_s3_bucket.photo.id

  lifecycle {
    prevent_destroy = true
  }

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "photo" {
  bucket = aws_s3_bucket.photo.id

  lifecycle {
    prevent_destroy = true
  }

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# --------------------
# DynamoDB tables
# --------------------
resource "aws_dynamodb_table" "post_media" {
  name         = "${local.app_name}-post-media-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "post_id"
  range_key    = "sequence"

  attribute {
    name = "post_id"
    type = "S"
  }

  attribute {
    name = "sequence"
    type = "S"
  }

  attribute {
    name = "state"
    type = "S"
  }

  global_secondary_index {
    name            = "state-index"
    hash_key        = "state"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = local.tags
}

resource "aws_dynamodb_table" "moderation_override" {
  name         = "${local.app_name}-moderation-override-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "reference"

  attribute {
    name = "reference"
    type = "S"
  }

  attribute {
    name = "type"
    type = "S"
  }

  global_secondary_index {
    name            = "type-index"
    hash_key        = "type"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = local.tags
}

# --------------------
# Profile readiness table
# --------------------
resource "aws_dynamodb_table" "profile_readiness" {
  name         = "${local.app_name}-profile-readiness-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "updated_at"
    type = "S"
  }

  global_secondary_index {
    name            = "updated_at-index"
    hash_key        = "updated_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = local.tags
}

# --------------------
# User profile table
# --------------------
resource "aws_dynamodb_table" "profile_user" {
  name         = "${local.app_name}-users-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "line_id"

  attribute {
    name = "line_id"
    type = "S"
  }

  attribute {
    name = "user_uuid"
    type = "S"
  }

  global_secondary_index {
    name            = "user_uuid-index"
    hash_key        = "user_uuid"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = local.tags
}

# --------------------
# Posts table
# --------------------
resource "aws_dynamodb_table" "posts" {
  name         = "${local.app_name}-posts-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "post_id"

  attribute {
    name = "post_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "user_id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = local.tags
}

# --------------------
# Post contact table
# --------------------
resource "aws_dynamodb_table" "post_contact" {
  name         = "${local.app_name}-post-contact-${local.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "post_id"
  range_key    = "contact_id"

  attribute {
    name = "post_id"
    type = "S"
  }

  attribute {
    name = "contact_id"
    type = "S"
  }

  attribute {
    name = "recipient_user_id"
    type = "S"
  }

  attribute {
    name = "sender_user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "recipient_user_id-index"
    hash_key        = "recipient_user_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "sender_user_id-index"
    hash_key        = "sender_user_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = local.tags
}

# --------------------
# Messaging & Events
# --------------------
resource "aws_sqs_queue" "photo_intake" {
  name                       = "${local.app_name}-photo-intake-${local.env}"
  visibility_timeout_seconds = 120
  message_retention_seconds  = 604800
  receive_wait_time_seconds  = 10

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.photo_dlq.arn
    maxReceiveCount     = 5
  })

  tags = local.tags
}

resource "aws_sqs_queue" "photo_dlq" {
  name = "${local.app_name}-photo-intake-dlq-${local.env}"

  tags = local.tags
}

resource "aws_sns_topic" "notify_in_app" {
  name              = "${local.app_name}-notify-inapp-${local.env}"
  kms_master_key_id = "alias/aws/sns"

  tags = local.tags
}

resource "aws_sns_topic" "notify_line" {
  name              = "${local.app_name}-notify-line-${local.env}"
  kms_master_key_id = "alias/aws/sns"

  tags = local.tags
}

resource "aws_cloudwatch_event_bus" "app" {
  name = "${local.app_name}-${local.env}"

  tags = local.tags
}

resource "aws_cloudwatch_event_rule" "moderation_outcome" {
  name           = "${local.app_name}-moderation-${local.env}"
  description    = "Route moderation outcomes to SNS"
  event_bus_name = aws_cloudwatch_event_bus.app.name
  event_pattern = jsonencode({
    "source" : ["oshinooshi.moderation"],
    "detail-type" : ["photo.moderation.result"]
  })
}

resource "aws_cloudwatch_event_target" "moderation_to_sns" {
  rule           = aws_cloudwatch_event_rule.moderation_outcome.name
  target_id      = "inapp-sns"
  arn            = aws_sns_topic.notify_in_app.arn
  event_bus_name = aws_cloudwatch_event_bus.app.name
}

resource "aws_sns_topic_policy" "notify_in_app" {
  arn = aws_sns_topic.notify_in_app.arn

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "events.amazonaws.com"
        },
        Action   = "sns:Publish",
        Resource = aws_sns_topic.notify_in_app.arn,
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.moderation_outcome.arn
          }
        }
      }
    ]
  })
}

# --------------------
# Lambda execution role and policies
# --------------------
resource "aws_iam_role" "photo_processor" {
  name = "${local.app_name}-photo-processor-${local.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.photo_processor.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "photo_processor_access" {
  name = "${local.app_name}-photo-processor-access-${local.env}"
  role = aws_iam_role.photo_processor.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = ["s3:GetObject", "s3:PutObject", "s3:CopyObject", "s3:DeleteObject", "s3:GetObjectTagging", "s3:PutObjectTagging"],
        Resource = [
          "${aws_s3_bucket.photo.arn}/*"
        ]
      },
      {
        Effect = "Allow",
        Action = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"],
        Resource = [
          aws_dynamodb_table.post_media.arn,
          aws_dynamodb_table.moderation_override.arn,
          "${aws_dynamodb_table.moderation_override.arn}/index/*",
          "${aws_dynamodb_table.post_media.arn}/index/*"
        ]
      },
      {
        Effect = "Allow",
        Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"],
        Resource = [
          aws_sqs_queue.photo_intake.arn,
          aws_sqs_queue.photo_dlq.arn
        ]
      },
      {
        Effect = "Allow",
        Action = ["sns:Publish"],
        Resource = [
          aws_sns_topic.notify_in_app.arn,
          aws_sns_topic.notify_line.arn
        ]
      },
      {
        Effect   = "Allow",
        Action   = ["events:PutEvents"],
        Resource = [aws_cloudwatch_event_bus.app.arn]
      },
      {
        Effect   = "Allow",
        Action   = ["rekognition:DetectModerationLabels", "rekognition:DetectLabels", "rekognition:DetectText"],
        Resource = "*"
      }
    ]
  })
}

# --------------------
# Profile readiness writer Lambda
# --------------------
resource "aws_iam_role" "profile_readiness_writer" {
  name = "${local.app_name}-profile-readiness-writer-${local.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "profile_readiness_writer_basic" {
  role       = aws_iam_role.profile_readiness_writer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "profile_readiness_writer_access" {
  name = "${local.app_name}-profile-readiness-writer-access-${local.env}"
  role = aws_iam_role.profile_readiness_writer.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem"
        ],
        Resource = [
          aws_dynamodb_table.profile_readiness.arn
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "profile_readiness_writer" {
  function_name = "${local.app_name}-profile-readiness-writer-${local.env}"
  role          = aws_iam_role.profile_readiness_writer.arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  timeout       = 10
  memory_size   = 256

  s3_bucket = var.lambda_package_bucket
  s3_key    = var.profile_readiness_package_key
  # Use local artifact to compute hash for update detection
  source_code_hash = filebase64sha256("${path.module}/../../lambda/profile-readiness-writer/profile-readiness-writer.zip")

  environment {
    variables = {
      PROFILE_READINESS_TABLE = aws_dynamodb_table.profile_readiness.name
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.profile_readiness_writer_basic,
    aws_iam_role_policy.profile_readiness_writer_access
  ]

  tags = local.tags
}

resource "aws_lambda_function_url" "profile_readiness_writer" {
  function_name      = aws_lambda_function.profile_readiness_writer.arn
  authorization_type = "AWS_IAM"
}

# --------------------
# API Gateway for profile readiness writer
# --------------------
resource "aws_apigatewayv2_api" "profile_api" {
  name          = "${local.app_name}-profile-api-${local.env}"
  protocol_type = "HTTP"

  tags = local.tags
}

resource "aws_apigatewayv2_integration" "profile_api_lambda" {
  api_id                 = aws_apigatewayv2_api.profile_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.profile_readiness_writer.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "profile_api_route" {
  api_id    = aws_apigatewayv2_api.profile_api.id
  route_key = "POST /profile-readiness"
  target    = "integrations/${aws_apigatewayv2_integration.profile_api_lambda.id}"
}

resource "aws_apigatewayv2_stage" "profile_api_stage" {
  api_id      = aws_apigatewayv2_api.profile_api.id
  name        = "$default"
  auto_deploy = true

  tags = local.tags
}

resource "aws_lambda_permission" "profile_api_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.profile_readiness_writer.arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.profile_api.execution_arn}/*/*"
}

# --------------------
# Lambda & event source
# --------------------
resource "aws_lambda_function" "photo_processor" {
  function_name = "${local.app_name}-photo-processor-${local.env}"
  role          = aws_iam_role.photo_processor.arn
  handler       = var.lambda_handler
  runtime       = var.lambda_runtime
  timeout       = 30
  memory_size   = 1024

  s3_bucket = var.lambda_package_bucket
  s3_key    = var.lambda_package_key

  environment {
    variables = {
      PHOTO_BUCKET_NAME         = aws_s3_bucket.photo.bucket
      PHOTO_PROCESSOR_QUEUE_URL = aws_sqs_queue.photo_intake.id
      PHOTO_PROCESSOR_DLQ_URL   = aws_sqs_queue.photo_dlq.id
      MODERATION_CONFIG_PATH    = var.moderation_config_path
      MODERATION_OVERRIDE_TABLE = aws_dynamodb_table.moderation_override.name
      POST_MEDIA_TABLE          = aws_dynamodb_table.post_media.name
      NOTIFY_IN_APP_TOPIC_ARN   = aws_sns_topic.notify_in_app.arn
      NOTIFY_LINE_TOPIC_ARN     = aws_sns_topic.notify_line.arn
      EVENT_BUS_NAME            = aws_cloudwatch_event_bus.app.name
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.photo_processor_access
  ]

  tags = local.tags
}

resource "aws_lambda_event_source_mapping" "photo_intake" {
  event_source_arn = aws_sqs_queue.photo_intake.arn
  function_name    = aws_lambda_function.photo_processor.arn
  batch_size       = 1
}

# --------------------
# CloudFront distribution
# --------------------
resource "aws_cloudfront_origin_access_control" "photo" {
  name                              = "${local.app_name}-photo-oac-${local.env}"
  description                       = "Access control for photo bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "photo" {
  enabled             = true
  comment             = "${local.app_name} media distribution (${local.env})"
  default_root_object = ""
  wait_for_deployment = false

  origin {
    domain_name              = aws_s3_bucket.photo.bucket_regional_domain_name
    origin_id                = "photo-public"
    origin_access_control_id = aws_cloudfront_origin_access_control.photo.id
    origin_path              = "/public/posts"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "photo-public"

    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      cookies {
        forward = "whitelist"
        whitelisted_names = [
          "CloudFront-Policy",
          "CloudFront-Signature",
          "CloudFront-Key-Pair-Id"
        ]
      }
    }

    compress    = true
    min_ttl     = 0
    default_ttl = 31536000
    max_ttl     = 31536000
  }

  price_class = "PriceClass_200"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = local.tags
}

resource "aws_s3_bucket_policy" "photo" {
  bucket = aws_s3_bucket.photo.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly",
        Effect = "Allow",
        Principal = {
          Service = "cloudfront.amazonaws.com"
        },
        Action   = "s3:GetObject",
        Resource = "${aws_s3_bucket.photo.arn}/public/posts/*",
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.photo.arn
          }
        }
      }
    ]
  })
}
