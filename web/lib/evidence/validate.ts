/** Port of magic-byte and size checks from proofpay/evidence.py */
export const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;
export const MAX_EVIDENCE_FILES = 3;

const PNG_MAGIC = Buffer.from("89504e470d0a1a0a", "hex");
const JPEG_MAGIC = Buffer.from("ffd8ff", "hex");

export type PreparedEvidenceFile = {
  filename: string;
  contentType: string;
  data: Buffer;
  digest: string;
};

export function validateEvidenceFilename(name: string): boolean {
  if (!name || name.length > 160) return false;
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) return false;
  for (const c of name) {
    if (c.charCodeAt(0) < 32) return false;
  }
  return true;
}

export function validateEvidenceBytes(
  filename: string,
  contentType: string,
  data: Buffer,
): boolean {
  if (!data.length || data.length > MAX_EVIDENCE_SIZE) return false;
  const ext = filename.includes(".")
    ? `.${filename.split(".").pop()!.toLowerCase()}`
    : "";
  if (
    ext === ".pdf" &&
    contentType === "application/pdf" &&
    data.subarray(0, 5).toString("utf8") === "%PDF-"
  ) {
    return true;
  }
  if (
    ext === ".png" &&
    contentType === "image/png" &&
    data.subarray(0, 8).equals(PNG_MAGIC)
  ) {
    return true;
  }
  if (
    (ext === ".jpg" || ext === ".jpeg") &&
    contentType === "image/jpeg" &&
    data.subarray(0, 3).equals(JPEG_MAGIC)
  ) {
    return true;
  }
  return false;
}

export const EVIDENCE_TYPE_ERROR =
  "Use PDF, JPEG or PNG files up to 5 MiB with matching file content and type.";
