import type { ObjectCannedACL } from "@aws-sdk/client-s3";

const ALLOWED_OBJECT_ACLS = [
  "private",
  "public-read",
  "public-read-write",
  "authenticated-read",
  "aws-exec-read",
  "bucket-owner-read",
  "bucket-owner-full-control",
] as const satisfies readonly ObjectCannedACL[];

export function parseObjectCannedAcl(value?: string): ObjectCannedACL | undefined {
  if (!value) {
    return undefined;
  }

  return (ALLOWED_OBJECT_ACLS as readonly string[]).includes(value)
    ? (value as ObjectCannedACL)
    : undefined;
}

export { ALLOWED_OBJECT_ACLS };
