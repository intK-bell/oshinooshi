# Terraform Deployment Guide

## Prerequisites
- Terraform >= 1.6.x
- AWS CLI configured with credentials scoped to target account
- S3 bucket for Terraform state (`s3://oshinooshi-terraform-state`) and DynamoDB lock table (e.g., `terraform-locks`)
- Lambda artifact uploaded to the bucket referenced in `terraform.tfvars`
- `config/moderation-settings.yaml` prepared and packaged with Lambda or retrievable at runtime

## Initial Setup
1. Copy sample vars:
   ```bash
   cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
   ```
2. Update `infra/terraform/terraform.tfvars` with environment-specific values (environment code, ACM certificate ARN, Lambda artifact key, etc.).
3. (Optional) Configure remote state in `infra/terraform/backend.hcl` and initialise:
   ```bash
   cat <<'HCL' > infra/terraform/backend.hcl
   bucket         = "oshinooshi-terraform-state"
   key            = "${ENV}/media-infra.tfstate"
   region         = "ap-northeast-1"
   dynamodb_table = "terraform-locks"
   encrypt        = true
   HCL
   ```

## Running Terraform
```bash
cd infra/terraform
terraform init [-backend-config=backend.hcl]
terraform workspace select stg || terraform workspace new stg
terraform plan -out=plan.out
terraform apply plan.out
```

## Post-Deploy Checklist
- Record outputs (`photo_bucket_name`, `photo_distribution_id`, `event_bus_name`, topic ARNs) and feed into application config / Secrets Manager.
- Configure CloudFront alternate domain and deploy DNS CNAME pointing to distribution.
- Attach subscribers to SNS topics (in-app worker, LINE webhook).
- Grant dispute tooling IAM role `PhotoArchiveAccess` permission to `protected/archives/*` prefix if needed.
- Set up CloudWatch alarms for SQS DLQ > 0 and Lambda errors.

## Updating Lambda Code
1. Package new Lambda artifact and upload to `lambda_package_bucket`/`lambda_package_key` path.
2. Run `terraform apply` with updated key or version to redeploy.
3. Confirm new version by checking Lambda console or invoking health endpoint.

## Destroy (Non-Prod Only)
```bash
terraform destroy
```
Use with caution; this will remove S3 buckets (must be emptied first), DynamoDB tables, and CDN resources.
