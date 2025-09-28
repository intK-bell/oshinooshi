"""SNS → Discord webhook relay for CloudWatch alarm notifications."""
import base64
import json
import os
import urllib.error
import urllib.request

import boto3
from botocore.exceptions import ClientError

WEBHOOK_URL_ENV = os.environ.get("DISCORD_WEBHOOK_URL")
SECRET_ARN = os.environ.get("DISCORD_SECRET_ARN")
_SECRETS_CLIENT = None
_WEBHOOK_CACHE = None


def handler(event, _context):
    webhook_url = _resolve_webhook_url()

    for record in event.get("Records", []):
        message = record.get("Sns", {}).get("Message")
        if not message:
            continue

        payload = _build_payload(message)
        _post_to_discord(webhook_url, payload)


def _resolve_webhook_url() -> str:
    global _WEBHOOK_CACHE, _SECRETS_CLIENT

    if WEBHOOK_URL_ENV:
        return WEBHOOK_URL_ENV

    if _WEBHOOK_CACHE:
        return _WEBHOOK_CACHE

    if not SECRET_ARN:
        raise RuntimeError("Discord webhook is not configured. Set DISCORD_SECRET_ARN or DISCORD_WEBHOOK_URL.")

    if not _SECRETS_CLIENT:
        _SECRETS_CLIENT = boto3.client("secretsmanager")

    try:
        response = _SECRETS_CLIENT.get_secret_value(SecretId=SECRET_ARN)
    except ClientError as exc:
        raise RuntimeError(f"Failed to retrieve Discord webhook secret: {exc}") from exc

    secret = response.get("SecretString")
    if not secret and "SecretBinary" in response:
        secret = base64.b64decode(response["SecretBinary"]).decode("utf-8")

    if not secret:
        raise RuntimeError("Discord webhook secret is empty.")

    _WEBHOOK_CACHE = secret
    return secret


def _build_payload(message: str) -> dict:
    try:
        alarm = json.loads(message)
    except json.JSONDecodeError:
        # Fallback for non-JSON payloads
        return {
            "content": f":rotating_light: *SNS Notification*\n```{message}```"
        }

    alarm_name = alarm.get("AlarmName", "Unknown Alarm")
    state = alarm.get("NewStateValue", "Unknown")
    reason = alarm.get("NewStateReason", "")
    description = alarm.get("AlarmDescription", "なし")

    color = 0xD00000 if state == "ALARM" else 0x439FE0 if state == "OK" else 0xFFA500

    return {
        "content": f":rotating_light: **{alarm_name}**",
        "embeds": [
            {
                "color": color,
                "fields": [
                    {"name": "状態", "value": state, "inline": True},
                    {"name": "理由", "value": reason[:1024] or "(詳細なし)", "inline": False},
                    {"name": "説明", "value": description[:1024], "inline": False},
                ],
            }
        ],
    }


def _post_to_discord(webhook_url: str, payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "aws-lambda-discord/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status >= 300:
                body = resp.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"Discord webhook failed: {resp.status}: {body}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(
            json.dumps(
                {
                    "level": "ERROR",
                    "message": "Discord webhook rejected request",
                    "status": exc.code,
                    "response": body[:512],
                }
            ),
            flush=True,
        )
        raise RuntimeError(f"Discord webhook failed with status {exc.code}: {body}") from exc
