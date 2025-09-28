bucket         = "oshinooshi-terraform-state"
key            = "stg/media-infra.tfstate"
region         = "ap-northeast-1"
dynamodb_table = "oshinooshi-terraform-locks"
encrypt        = true
skip_credentials_validation = true
skip_region_validation      = true
skip_metadata_api_check     = true
