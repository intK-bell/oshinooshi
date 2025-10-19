#!/usr/bin/env bash
set -euo pipefail

# Simple orchestrator that follows docs/lambda-testing.md.
# Requires AWS credentials with access to the oshinooshi environment.

function usage() {
  cat <<'USAGE'
Usage: run-lambda-tests.sh [--environment stg] [--profile oshinooshi-stg] [--outputs tmp/terraform-outputs.json] [--keep-artifacts]

Options:
  --environment    Environment suffix (matches terraform var.environment). Default: stg
  --profile        AWS profile to use (falls back to $AWS_PROFILE)
  --outputs        Path to terraform outputs JSON. If omitted, the script will call terraform output -json.
  --keep-artifacts Keep test data in S3/DynamoDB for inspection. Default: remove at the end.
  --help           Show this message.
USAGE
}

ENVIRONMENT="stg"
PROFILE="${AWS_PROFILE:-}"
OUTPUTS_JSON=""
KEEP_ARTIFACTS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --outputs)
      OUTPUTS_JSON="$2"
      shift 2
      ;;
    --keep-artifacts)
      KEEP_ARTIFACTS=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

if ! command -v envsubst >/dev/null 2>&1; then
  echo "envsubst (gettext) is required." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required." >&2
  exit 1
fi

if [[ -z "${OUTPUTS_JSON}" ]] && ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required when --outputs is not provided." >&2
  exit 1
fi

if [[ -z "${PROFILE}" ]]; then
  echo "AWS profile is not set. Use --profile or export AWS_PROFILE." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="${REPO_ROOT}/tmp"
mkdir -p "${TMP_DIR}"

if [[ -z "${OUTPUTS_JSON}" ]]; then
  TF_DIR="${REPO_ROOT}/infra/terraform"
  echo "Reading terraform outputs from ${TF_DIR}..."
  if ! AWS_PROFILE="${PROFILE}" terraform -chdir="${TF_DIR}" output -json > "${TMP_DIR}/terraform-outputs.json"; then
    echo "Failed to read terraform outputs. Ensure AWS credentials for backend access are configured (e.g. run 'aws sso login --profile ${PROFILE}') or supply a pre-generated JSON via --outputs." >&2
    exit 1
  fi
  OUTPUTS_JSON="${TMP_DIR}/terraform-outputs.json"
fi

if [[ ! -f "${OUTPUTS_JSON}" ]]; then
  echo "Terraform outputs file not found: ${OUTPUTS_JSON}" >&2
  exit 1
fi

function read_output() {
  local key="$1"
  jq -r --arg key "${key}" '.[$key].value' "${OUTPUTS_JSON}"
}

PHOTO_BUCKET=$(read_output "photo_bucket_name")
PHOTO_QUEUE_URL=$(read_output "photo_intake_queue_url")
PHOTO_DLQ_URL=$(read_output "photo_intake_dlq_url")
POST_MEDIA_TABLE=$(read_output "post_media_table_name")
PROFILE_TABLE=$(read_output "profile_readiness_table_name")
PROFILE_FN_ARN=$(read_output "profile_readiness_writer_function_arn")

if [[ -z "${PHOTO_BUCKET}" || "${PHOTO_BUCKET}" == "null" ]]; then
  echo "photo_bucket_name output is missing." >&2
  exit 1
fi

TEST_ID="$(date -u +%Y%m%dT%H%M%SZ)"
SOURCE_KEY="transient/drafts/devtools/${TEST_ID}.jpg"
TARGET_BASE="public/posts/test/post-${TEST_ID}/v1"
AWS_CMD=(aws --profile "${PROFILE}" --region "ap-northeast-1")

echo "Generating sample JPEG..."
SAMPLE_IMG="${TMP_DIR}/sample.jpg"
python3 - <<'PY' "${SAMPLE_IMG}"
import base64
import pathlib
import sys

target = pathlib.Path(sys.argv[1])
data = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0pMTk1"
    "MjU1MjU1MjU1MjU1MjU1MjU1MjU1MjU1MjU1MjU1MjU1MjU1MjU1MjU1MjX/2wBDAQ4QEBUU"
    "GBgaGCUiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjIyMjIyMjX/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEA"
    "EAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/"
    "2gAIAQEAAQUCUP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8BQ//EABQRAQAAAAAAAA"
    "AAAAAAAAAAAAD/2gAIAQIBAT8BQ//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8CQ//Z"
)
target.write_bytes(data)
PY

echo "Uploading sample image to s3://${PHOTO_BUCKET}/${SOURCE_KEY}..."
"${AWS_CMD[@]}" s3 cp "${SAMPLE_IMG}" "s3://${PHOTO_BUCKET}/${SOURCE_KEY}"

echo "Preparing SQS message payload..."
PAYLOAD_TEMPLATE="${TMP_DIR}/photo-processor-event.json"
PAYLOAD_RESOLVED="${TMP_DIR}/photo-processor-event.resolved.json"
cat <<'JSON' > "${PAYLOAD_TEMPLATE}"
{
  "postId": "post-${TEST_ID}",
  "sequence": "00",
  "version": 1,
  "userId": "user-${TEST_ID}",
  "source": {
    "bucket": "${PHOTO_BUCKET}",
    "key": "${SOURCE_KEY}"
  },
  "target": {
    "baseKey": "${TARGET_BASE}"
  },
  "uploadedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "derivativeOptions": {
    "coverWidth": 1200,
    "thumbSize": 400
  }
}
JSON
TEST_ID="${TEST_ID}" \
PHOTO_BUCKET="${PHOTO_BUCKET}" \
SOURCE_KEY="${SOURCE_KEY}" \
TARGET_BASE="${TARGET_BASE}" \
envsubst < "${PAYLOAD_TEMPLATE}" > "${PAYLOAD_RESOLVED}"

echo "Sending SQS message..."
"${AWS_CMD[@]}" sqs send-message \
  --queue-url "${PHOTO_QUEUE_URL}" \
  --message-body "file://${PAYLOAD_RESOLVED}"

echo "Waiting for queue to drain..."
for _ in {1..30}; do
  VISIBLE=$("${AWS_CMD[@]}" sqs get-queue-attributes \
    --queue-url "${PHOTO_QUEUE_URL}" \
    --attribute-names ApproximateNumberOfMessages \
    --query 'Attributes.ApproximateNumberOfMessages' \
    --output text)
  NOT_VISIBLE=$("${AWS_CMD[@]}" sqs get-queue-attributes \
    --queue-url "${PHOTO_QUEUE_URL}" \
    --attribute-names ApproximateNumberOfMessagesNotVisible \
    --query 'Attributes.ApproximateNumberOfMessagesNotVisible' \
    --output text)
  if [[ "${VISIBLE}" == "0" && "${NOT_VISIBLE}" == "0" ]]; then
    break
  fi
  sleep 5
done

echo "Checking DLQ depth..."
DLQ_MESSAGES=$("${AWS_CMD[@]}" sqs get-queue-attributes \
  --queue-url "${PHOTO_DLQ_URL}" \
  --attribute-names ApproximateNumberOfMessages \
  --query 'Attributes.ApproximateNumberOfMessages' \
  --output text)

if [[ "${DLQ_MESSAGES}" != "0" ]]; then
  echo "Warning: DLQ contains ${DLQ_MESSAGES} messages."
fi

echo "Listing generated S3 objects..."
"${AWS_CMD[@]}" s3 ls "s3://${PHOTO_BUCKET}/${TARGET_BASE}/"

echo "Fetching object tagging..."
"${AWS_CMD[@]}" s3api get-object-tagging \
  --bucket "${PHOTO_BUCKET}" \
  --key "${TARGET_BASE}/img-00.jpg"

echo "Reading DynamoDB record..."
"${AWS_CMD[@]}" dynamodb get-item \
  --table-name "${POST_MEDIA_TABLE}" \
  --key "{\"post_id\":{\"S\":\"post-${TEST_ID}\"},\"sequence\":{\"S\":\"00\"}}"

echo "Invoking profile-readiness writer via function URL..."
PROFILE_FN_URL=$("${AWS_CMD[@]}" lambda get-function-url-config \
  --function-name "${PROFILE_FN_ARN}" \
  --query 'FunctionUrl' \
  --output text)

PROFILE_PAYLOAD_TEMPLATE="${TMP_DIR}/profile-readiness-payload.json"
PROFILE_PAYLOAD_RESOLVED="${TMP_DIR}/profile-readiness-payload.resolved.json"
cat <<'JSON' > "${PROFILE_PAYLOAD_TEMPLATE}"
{
  "userId": "user-${TEST_ID}",
  "sections": {
    "profile": "complete",
    "media": "pending"
  }
}
JSON
TEST_ID="${TEST_ID}" envsubst < "${PROFILE_PAYLOAD_TEMPLATE}" > "${PROFILE_PAYLOAD_RESOLVED}"

AWS_VERSION_RAW=$(aws --version 2>&1 | head -n1)
CLI_MAJOR=$(echo "${AWS_VERSION_RAW}" | sed -n 's/^aws-cli\/\([0-9]\+\)\..*/\1/p')
CLI_MINOR=$(echo "${AWS_VERSION_RAW}" | sed -n 's/^aws-cli\/[0-9]\+\.\([0-9]\+\).*/\1/p')
SUPPORTS_FN_URL=0
if [[ -n "${CLI_MAJOR}" && -n "${CLI_MINOR}" ]]; then
  if (( CLI_MAJOR > 2 )) || (( CLI_MAJOR == 2 && CLI_MINOR >= 13 )); then
    SUPPORTS_FN_URL=1
  fi
fi

if [[ "${SUPPORTS_FN_URL}" -eq 1 ]]; then
  "${AWS_CMD[@]}" lambda invoke-function-url \
    --function-name "${PROFILE_FN_ARN}" \
    --qualifier "\$LATEST" \
    --payload "fileb://${PROFILE_PAYLOAD_RESOLVED}" \
    "${TMP_DIR}/profile-readiness-response.json" \
    --cli-binary-format raw-in-base64-out
  cat "${TMP_DIR}/profile-readiness-response.json"
else
  echo "aws CLI version does not support invoke-function-url. Skipping direct invocation."
fi

echo "Checking profile readiness DynamoDB record..."
"${AWS_CMD[@]}" dynamodb get-item \
  --table-name "${PROFILE_TABLE}" \
  --key "{\"user_id\":{\"S\":\"user-${TEST_ID}\"}}"

if [[ "${KEEP_ARTIFACTS}" -eq 0 ]]; then
  echo "Cleaning up S3 objects..."
  "${AWS_CMD[@]}" s3 rm "s3://${PHOTO_BUCKET}/${SOURCE_KEY}"
  "${AWS_CMD[@]}" s3 rm "s3://${PHOTO_BUCKET}/${TARGET_BASE}/img-00.jpg" || true
  "${AWS_CMD[@]}" s3 rm "s3://${PHOTO_BUCKET}/${TARGET_BASE}/img-00-cover.jpg" || true
  "${AWS_CMD[@]}" s3 rm "s3://${PHOTO_BUCKET}/${TARGET_BASE}/img-00-thumb.jpg" || true

  echo "Deleting DynamoDB items..."
  "${AWS_CMD[@]}" dynamodb delete-item \
    --table-name "${POST_MEDIA_TABLE}" \
    --key "{\"post_id\":{\"S\":\"post-${TEST_ID}\"},\"sequence\":{\"S\":\"00\"}}"
  "${AWS_CMD[@]}" dynamodb delete-item \
    --table-name "${PROFILE_TABLE}" \
    --key "{\"user_id\":{\"S\":\"user-${TEST_ID}\"}}"
else
  echo "Keeping artifacts as requested."
fi

echo "All steps completed. Review CloudWatch Logs manually if needed:"
echo "aws --profile ${PROFILE} --region ap-northeast-1 logs tail \"/aws/lambda/oshinooshi-photo-processor-${ENVIRONMENT}\" --follow"
