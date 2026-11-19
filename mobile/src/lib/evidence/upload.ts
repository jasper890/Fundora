import { api, ApiError } from '@/lib/api/client';
import { anyOk, beginSchema } from '@/lib/api/schemas';
import type { EvidenceType } from '@/lib/evidence/rules';

export type DraftFile = { uri: string; name: string; type: EvidenceType; size: number };

export type UploadInput = {
  awardId: string;
  expectedRevision: number;
  explanation: string;
  sourceRef: string;
  files: DraftFile[];
};

export type UploadStep = 'beginning' | 'uploading' | 'finalizing';

export type UploadDeps = {
  api: typeof api;
  /** PUT one file's bytes to its single-use signed Storage URL. */
  put: (signedUrl: string, file: DraftFile) => Promise<Response>;
};

/**
 * begin → signed Storage uploads → finalize, the same three steps as the web form.
 * Any failure after begin cancels the reservation so no orphan objects remain;
 * the caller keeps the draft files for a retry.
 */
export async function uploadEvidence(
  input: UploadInput,
  deps: UploadDeps,
  onStep: (step: UploadStep, done: number) => void = () => undefined,
) {
  const base = `/api/v1/awards/${input.awardId}/evidence`;
  onStep('beginning', 0);
  const begun = await deps.api(`${base}/begin`, beginSchema, {
    method: 'POST',
    body: {
      explanation: input.explanation.trim(),
      source_ref: input.sourceRef.trim(),
      expected_revision: input.expectedRevision,
      filenames: input.files.map((f) => f.name),
      content_types: input.files.map((f) => f.type),
    },
  });
  try {
    if (begun.uploads.length !== input.files.length) {
      throw new ApiError(500, 'BAD_RESPONSE', 'Unexpected server response. Your draft is kept.');
    }
    for (let i = 0; i < input.files.length; i += 1) {
      onStep('uploading', i);
      const response = await deps.put(begun.uploads[i].signedUrl, input.files[i]).catch(() => null);
      if (!response?.ok) {
        throw new ApiError(response?.status ?? 0, 'UPLOAD_FAILED', 'Upload interrupted. Your draft is kept — try again.');
      }
    }
    onStep('finalizing', input.files.length);
    return await deps.api(`${base}/finalize`, anyOk, {
      method: 'POST',
      body: { reservation_id: begun.reservation_id, filenames: input.files.map((f) => f.name) },
    });
  } catch (error) {
    await deps
      .api(`${base}/begin`, anyOk, { method: 'DELETE', body: { reservation_id: begun.reservation_id } })
      .catch(() => undefined);
    throw error;
  }
}
