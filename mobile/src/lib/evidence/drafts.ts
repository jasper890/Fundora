import { fetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { getAccessToken } from '@/lib/auth/session';
import { config } from '@/lib/config';
import {
  hasExif,
  MAX_EVIDENCE_BYTES,
  photoName,
  safePdfName,
  sniffType,
  type EvidenceType,
} from '@/lib/evidence/rules';
import type { DraftFile } from '@/lib/evidence/upload';

// App-private storage: drafts survive an app restart until upload succeeds, and never touch the gallery.
const draftsRoot = () => new Directory(Paths.document, 'evidence-drafts');
const viewRoot = () => new Directory(Paths.cache, 'evidence-view');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DraftError extends Error {}

function draftDir(awardId: string) {
  // The id comes from a route param (deep links): never let it become a path.
  if (!UUID.test(awardId)) throw new DraftError('Unknown award.');
  return new Directory(draftsRoot(), awardId);
}

function head(file: File, length = 64 * 1024): Uint8Array {
  const handle = file.open();
  try {
    return handle.readBytesSync(Math.min(length, file.size));
  } finally {
    handle.close();
  }
}

function describe(file: File, type: EvidenceType): DraftFile {
  return { uri: file.uri, name: file.name, type, size: file.size };
}

/** Picker output lives in the app cache; drop it once the cleaned draft exists. */
function discard(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Not ours to delete (for example a provider URI): the OS cleans its own cache.
  }
}

function freeName(dir: Directory, name: string): File {
  const dot = name.lastIndexOf('.');
  for (let n = 1; ; n += 1) {
    const candidate = new File(dir, n === 1 ? name : `${name.slice(0, dot)}-${n}${name.slice(dot)}`);
    if (!candidate.exists) return candidate;
  }
}

/**
 * Camera or library image → JPEG ≤ 2048 px, re-encoded so EXIF (including GPS location) is dropped.
 * HEIC/HEIF photos are converted the same way. Rejects any output that still carries EXIF.
 */
export async function addPhoto(awardId: string, sourceUri: string, index: number): Promise<DraftFile> {
  const dir = draftDir(awardId);
  dir.create({ intermediates: true, idempotent: true });
  const context = ImageManipulator.manipulate(sourceUri, { maxWidth: 2048, maxHeight: 2048 });
  const image = await context.renderAsync();
  try {
    for (const compress of [0.8, 0.6]) {
      const temp = new File((await image.saveAsync({ format: SaveFormat.JPEG, compress })).uri);
      if (temp.size > MAX_EVIDENCE_BYTES) {
        temp.delete();
        continue;
      }
      const bytes = head(temp);
      if (sniffType(bytes) !== 'image/jpeg' || hasExif(bytes)) {
        temp.delete();
        throw new DraftError('This photo could not be cleaned of location data. Try another photo.');
      }
      const target = new File(dir, photoName(index));
      if (target.exists) target.delete();
      temp.moveSync(target);
      discard(sourceUri);
      return describe(target, 'image/jpeg');
    }
    throw new DraftError('This photo is too large even after compression. Try another photo.');
  } finally {
    image.release();
    context.release();
  }
}

export function addPdf(awardId: string, sourceUri: string, originalName: string | null): DraftFile {
  const dir = draftDir(awardId);
  dir.create({ intermediates: true, idempotent: true });
  const source = new File(sourceUri);
  if (source.size > MAX_EVIDENCE_BYTES) throw new DraftError('PDFs must be 5 MB or smaller.');
  if (sniffType(head(source, 8)) !== 'application/pdf') throw new DraftError('That file is not a valid PDF.');
  const target = freeName(dir, safePdfName(originalName, 0));
  source.moveSync(target); // the picker's cache copy becomes the draft: no second copy left behind
  return describe(target, 'application/pdf');
}

/** Draft files kept from an earlier attempt, for the "no data loss" retry path. */
export function listDrafts(awardId: string): DraftFile[] {
  const dir = draftDir(awardId);
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((item): item is File => item instanceof File)
    .flatMap((file) => {
      const type = sniffType(head(file, 8));
      return type ? [describe(file, type)] : [];
    });
}

export function removeDraft(file: DraftFile) {
  discard(file.uri);
}

export function clearDrafts(awardId: string) {
  const dir = draftDir(awardId);
  if (dir.exists) dir.delete();
}

/** Explicit sign-out wipes every draft and every viewed evidence file. */
export function clearAllLocalEvidence() {
  for (const dir of [draftsRoot(), viewRoot()]) if (dir.exists) dir.delete();
}

export function putDraft(signedUrl: string, file: DraftFile) {
  return fetch(signedUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type, 'x-upsert': 'false' },
    body: new File(file.uri),
  }) as unknown as Promise<Response>;
}

/**
 * Downloads one evidence file through the authenticated route and opens the system viewer
 * (Quick Look on iOS; on Android the user's chosen viewer app). Only the latest viewed file is kept.
 */
export async function previewEvidence(fileId: string, filename: string, type: string) {
  const token = await getAccessToken();
  if (!token) throw new DraftError('Sign in again to view evidence.');
  const response = await fetch(`${config.apiBaseUrl}/api/v1/evidence/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!response.ok) throw new DraftError('Could not open this file. You may no longer have access.');
  const dir = viewRoot();
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });
  const extension = type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : 'jpg';
  const file = new File(dir, `evidence.${extension}`);
  file.writeSync(await response.bytes());
  await file.preview({ title: filename, mimeType: type });
}
