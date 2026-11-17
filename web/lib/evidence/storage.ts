import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const EVIDENCE_BUCKET = "evidence";

export async function createEvidenceUploadTokens(paths: string[]) {
  const admin = createSupabaseAdmin();
  const uploads: { path: string; token: string; signedUrl: string }[] = [];
  for (const path of paths) {
    const { data, error } = await admin.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new Error(error?.message || `Failed to sign upload for ${path}`);
    }
    uploads.push({
      path,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  }
  return uploads;
}

export async function downloadEvidenceObject(path: string): Promise<Buffer> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage.from(EVIDENCE_BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message || `Missing evidence object ${path}`);
  }
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

export async function deleteEvidenceObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const admin = createSupabaseAdmin();
  await admin.storage.from(EVIDENCE_BUCKET).remove(paths);
}

export async function createEvidenceDownloadUrl(
  path: string,
  expiresIn = 60,
  filename?: string,
): Promise<string> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, expiresIn, { download: filename ?? true });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || `Failed to sign download for ${path}`);
  }
  return data.signedUrl;
}
