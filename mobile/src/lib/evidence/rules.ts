// Mirrors web/lib/evidence/validate.ts. The server's finalize step stays authoritative.
export const MAX_EVIDENCE_FILES = 3;
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const MAX_EXPLANATION = 2000;
export const MAX_SOURCE_REF = 512;

export type EvidenceType = 'image/jpeg' | 'image/png' | 'application/pdf';

const startsWith = (bytes: Uint8Array, prefix: number[]) => prefix.every((b, i) => bytes[i] === b);

/** Content type from leading bytes, matching the server's signature checks. */
export function sniffType(bytes: Uint8Array): EvidenceType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

/** True when a JPEG still carries an EXIF block (which can hold GPS location). */
export function hasExif(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0xff, 0xd8])) return false;
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda) return false; // start of scan: no more metadata segments
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const exifTag = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
    if (marker === 0xe1 && exifTag.every((b, k) => bytes[i + 4 + k] === b)) return true;
    i += 2 + length;
  }
  return false;
}

/** Photos get neutral names so device or user names never reach the server. */
export function photoName(index: number): string {
  return `photo-${index + 1}.jpg`;
}

/** Same rules as the server's validateEvidenceFilename, plus a forced .pdf extension. */
export function safePdfName(original: string | null | undefined, index: number): string {
  const base = (original ?? '')
    .replace(/\.pdf$/i, '')
    .replace(/[\/\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 150);
  return `${base || `document-${index + 1}`}.pdf`;
}

export function validateFields(explanation: string, sourceRef: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const e = explanation.trim();
  const s = sourceRef.trim();
  if (!e) errors.explanation = 'Describe what this evidence shows.';
  else if (e.length > MAX_EXPLANATION) errors.explanation = `Use ${MAX_EXPLANATION} characters or fewer.`;
  if (!s) errors.sourceRef = 'Name the source record the verifier should check.';
  else if (s.length > MAX_SOURCE_REF) errors.sourceRef = `Use ${MAX_SOURCE_REF} characters or fewer.`;
  return errors;
}
