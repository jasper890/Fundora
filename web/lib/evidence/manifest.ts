import { createHash } from "node:crypto";

export type ManifestFile = {
  filename: string;
  sha256: string;
  size: number;
  content_type: string;
};

/**
 * Port of proofpay.evidence.canonical_manifest.
 * Django: json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)
 * Files must be passed in EvidenceFile insertion order (pk order).
 */
export function canonicalManifest(args: {
  awardId: string;
  revision: number;
  nonce: string;
  files: ManifestFile[];
  sourceRef: string;
  explanation: string;
}): Buffer {
  const manifest = {
    award: args.awardId,
    explanation: args.explanation,
    files: args.files.map((f) => ({
      content_type: f.content_type,
      filename: f.filename,
      sha256: f.sha256,
      size: f.size,
    })),
    nonce: args.nonce,
    revision: args.revision,
    schema: "proofpay-evidence-v1",
    source_ref: args.sourceRef,
  };
  return Buffer.from(JSON.stringify(manifest), "utf8");
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256")
    .update(typeof data === "string" ? Buffer.from(data, "utf8") : data)
    .digest("hex");
}
