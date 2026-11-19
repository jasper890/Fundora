import { hasExif, photoName, safePdfName, sniffType, validateFields } from './rules';

const bytes = (...b: number[]) => new Uint8Array(b);

test('sniffs only the three accepted signatures', () => {
  expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
  expect(sniffType(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
  expect(sniffType(new TextEncoder().encode('GIF89a'))).toBeNull();
  expect(sniffType(bytes())).toBeNull();
});

test('detects an EXIF block before the image data and ignores clean JPEGs', () => {
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  const app1 = [0xff, 0xe1, 0x00, 0x08, ...exif];
  const sos = [0xff, 0xda, 0x00, 0x02];
  expect(hasExif(bytes(0xff, 0xd8, ...app0, ...app1, ...sos))).toBe(true);
  expect(hasExif(bytes(0xff, 0xd8, ...app0, ...sos, ...app1))).toBe(false);
  expect(hasExif(new TextEncoder().encode('%PDF-'))).toBe(false);
});

test('names never carry paths, control characters or device names', () => {
  expect(photoName(0)).toBe('photo-1.jpg');
  expect(safePdfName('../../etc/report.PDF', 0)).toBe('....etcreport.pdf');
  expect(safePdfName('bad\u0000name.pdf', 1)).toBe('badname.pdf');
  expect(safePdfName('C:\scans\log.pdf', 0)).toBe('C:scanslog.pdf');
  expect(safePdfName(null, 2)).toBe('document-3.pdf');
  expect(safePdfName('x'.repeat(400), 0).length).toBeLessThanOrEqual(160);
});

test('field limits match the server', () => {
  expect(validateFields('', ' ')).toEqual({
    explanation: 'Describe what this evidence shows.',
    sourceRef: 'Name the source record the verifier should check.',
  });
  expect(validateFields('a'.repeat(2001), 'log')).toHaveProperty('explanation');
  expect(validateFields('Attended', 'Site log p.4')).toEqual({});
});
