#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

function section() {
  echo
  echo "==> $1"
}

function build_profile_readiness_writer() {
  local dir="$ROOT_DIR/lambda/profile-readiness-writer"
  section "profile-readiness-writer"

  if [[ ! -f "$dir/dist/index.js" ]]; then
    echo "dist/index.js が見つかりません。先にビルド成果物を配置してください。" >&2
    exit 1
  fi

  ( 
    cd "$dir"
    rm -f profile-readiness-writer.zip
    zip -j profile-readiness-writer.zip dist/index.js >/dev/null
    echo "  -> profile-readiness-writer.zip updated"
  )
}

function build_photo_processor() {
  local dir="$ROOT_DIR/lambda/photo-processor"
  section "photo-processor"

  (
    cd "$dir"
    npm ci --omit=dev
    node scripts/build.mjs
    rm -f photo-processor.zip
    zip -j photo-processor.zip dist/index.js dist/package.json >/dev/null
    echo "  -> photo-processor.zip updated"
  )
}

function build_sns_to_discord() {
  local dir="$ROOT_DIR/lambda/sns-to-discord"
  section "sns-to-discord"

  (
    cd "$dir"
    rm -f sns-to-discord.zip
    zip sns-to-discord.zip index.py >/dev/null
    echo "  -> sns-to-discord.zip updated"
  )
}

targets=("$@")
if [[ ${#targets[@]} -eq 0 ]]; then
  targets=("profile-readiness-writer" "photo-processor" "sns-to-discord")
fi

for target in "${targets[@]}"; do
  case "$target" in
    profile-readiness-writer) build_profile_readiness_writer ;;
    photo-processor) build_photo_processor ;;
    sns-to-discord) build_sns_to_discord ;;
    *)
      echo "Unknown target: $target" >&2
      exit 1
      ;;
  esac
done

echo
echo "Done."
