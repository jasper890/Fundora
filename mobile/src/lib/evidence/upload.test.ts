import { ApiError } from '@/lib/api/client';

import { uploadEvidence, type UploadDeps } from './upload';

jest.mock('@/lib/auth/session', () => ({ getAccessToken: jest.fn() }));

const input = {
  awardId: 'a1',
  expectedRevision: 2,
  explanation: ' Attended the cleanup ',
  sourceRef: 'Site log p.4',
  files: [
    { uri: 'file:///d/photo-1.jpg', name: 'photo-1.jpg', type: 'image/jpeg' as const, size: 10 },
    { uri: 'file:///d/report.pdf', name: 'report.pdf', type: 'application/pdf' as const, size: 20 },
  ],
};

function deps(overrides: Partial<{ put: UploadDeps['put']; finalize: () => unknown }> = {}) {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const api = jest.fn(async (path: string, _schema: unknown, init: { method?: string; body?: unknown } = {}) => {
    calls.push({ path, method: init.method, body: init.body });
    if (path.endsWith('/begin') && init.method === 'POST') {
      return { reservation_id: 'r1', uploads: [{ path: 'p1', signedUrl: 'u1' }, { path: 'p2', signedUrl: 'u2' }] };
    }
    if (path.endsWith('/finalize')) return overrides.finalize ? overrides.finalize() : { ok: true, revision: 3 };
    return { ok: true };
  });
  const put = overrides.put ?? jest.fn(async () => ({ ok: true, status: 200 }) as Response);
  return { deps: { api: api as unknown as UploadDeps['api'], put }, calls, put };
}

test('begins with trimmed fields, uploads each file to its own URL, then finalizes', async () => {
  const { deps: d, calls, put } = deps();
  const steps: string[] = [];
  await expect(uploadEvidence(input, d, (s, n) => steps.push(`${s}:${n}`))).resolves.toEqual({ ok: true, revision: 3 });
  expect(calls[0].body).toEqual({
    explanation: 'Attended the cleanup',
    source_ref: 'Site log p.4',
    expected_revision: 2,
    filenames: ['photo-1.jpg', 'report.pdf'],
    content_types: ['image/jpeg', 'application/pdf'],
  });
  expect(put).toHaveBeenNthCalledWith(1, 'u1', input.files[0]);
  expect(put).toHaveBeenNthCalledWith(2, 'u2', input.files[1]);
  expect(calls[1]).toEqual({
    path: '/api/v1/awards/a1/evidence/finalize',
    method: 'POST',
    body: { reservation_id: 'r1', filenames: ['photo-1.jpg', 'report.pdf'] },
  });
  expect(steps).toEqual(['beginning:0', 'uploading:0', 'uploading:1', 'finalizing:2']);
});

test('a failed file upload cancels the reservation and never finalizes', async () => {
  const { deps: d, calls } = deps({ put: jest.fn(async () => ({ ok: false, status: 500 }) as Response) });
  await expect(uploadEvidence(input, d)).rejects.toMatchObject({ code: 'UPLOAD_FAILED' });
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
    'POST /api/v1/awards/a1/evidence/begin',
    'DELETE /api/v1/awards/a1/evidence/begin',
  ]);
  expect(calls[1].body).toEqual({ reservation_id: 'r1' });
});

test('a stale finalize cancels the reservation and surfaces the server error', async () => {
  const stale = new ApiError(409, 'STALE_REVISION', 'Refresh before uploading a new revision.');
  const { deps: d, calls } = deps({
    finalize: () => {
      throw stale;
    },
  });
  await expect(uploadEvidence(input, d)).rejects.toBe(stale);
  expect(calls.at(-1)).toMatchObject({ method: 'DELETE', body: { reservation_id: 'r1' } });
});
