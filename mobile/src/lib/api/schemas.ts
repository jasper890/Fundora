import { z } from 'zod';

const member = z.object({ user_id: z.string(), role: z.string(), active: z.boolean(), public_wallet: z.string() });

export const awardSchema = z.object({
  id: z.string(),
  program_id: z.string(),
  recipient_username: z.string(),
  status: z.string(),
  // Postgres bigint: arrives as a decimal string.
  last_confirmed_ledger: z.union([z.number(), z.string()]).nullable(),
  sponsor_hold: z.boolean(),
  verifier_hold: z.boolean(),
  evidence_revision: z.number(),
  evidence_digest: z.string(),
  verifier_sync_required: z.boolean(),
  sponsor_member: member,
  verifier_member: member,
  recipient_member: member,
  latest_evidence: z.object({ revision: z.number(), digest: z.string() }).nullable(),
  unresolved_operation: z.boolean(),
  // Optional so the app still reads a server that predates them.
  deadlines: z.object({ claim: z.string(), review: z.string(), payout: z.string() }).optional(),
  my_open_operation: z.boolean().optional(),
  changes_requested: z.boolean().optional(),
  my_roles: z.array(z.enum(['SPONSOR', 'VERIFIER', 'RECIPIENT'])),
});
export type Award = z.infer<typeof awardSchema>;

const baseUnits = z.string().regex(/^\d+$/);

export const awardsSchema = z.object({ amount_base_units: baseUnits, awards: z.array(awardSchema) });

export const evidenceSchema = z.object({
  id: z.string(),
  revision: z.number(),
  digest: z.string(),
  explanation: z.string(),
  source_ref: z.string(),
  created_at: z.string(),
  files: z.array(z.object({ id: z.string(), filename: z.string(), content_type: z.string(), size: z.number() })),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const noteSchema = z.object({
  id: z.string(),
  kind: z.enum(['REQUEST_CHANGES', 'DISPUTE']),
  note: z.string(),
  source_check: z.string(),
  evidence_revision: z.number(),
  author_username: z.string(),
  created_at: z.string(),
});
export type ReviewNote = z.infer<typeof noteSchema>;

export const awardDetailSchema = z.object({
  award: awardSchema.extend({ version: z.string() }),
  program: z.object({
    id: z.string(),
    title: z.string(),
    requirements_text: z.string(),
    claim_deadline: z.string(),
    review_deadline: z.string(),
    payout_deadline: z.string(),
  }),
  amount_base_units: baseUnits,
  evidence: z.array(evidenceSchema),
  // Optional so the app still reads a server that predates notes.
  notes: z.array(noteSchema).default([]),
});
export type AwardDetail = z.infer<typeof awardDetailSchema>;

export const sessionSchema = z.union([
  z.object({
    authenticated: z.literal(true),
    username: z.string(),
    memberships: z.array(
      // public_wallet is optional so the app still works against a server that predates it.
      z.object({ program_id: z.string(), role: z.string(), title: z.string(), public_wallet: z.string().optional() }),
    ),
  }),
  z.object({ authenticated: z.literal(false) }),
]);
export type SessionInfo = Extract<z.infer<typeof sessionSchema>, { authenticated: true }>;

export const loginSchema = z.object({
  authenticated: z.literal(true),
  username: z.string(),
  password_change_required: z.boolean(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_at: z.number().optional(),
});

export const beginSchema = z.object({
  reservation_id: z.string(),
  uploads: z.array(z.object({ path: z.string(), signedUrl: z.string() })),
});

export const anyOk = z.unknown();

const opStatus = z.enum(['BUILDING', 'PREPARED', 'SIGNED', 'SUBMITTED', 'UNKNOWN', 'CONFIRMED_SUCCESS', 'CONFIRMED_FAILED', 'ABANDONED']);
export type OpStatus = z.infer<typeof opStatus>;

export const chainPreviewSchema = z.object({
  action: z.string(),
  network_passphrase: z.string(),
  signer: z.string(),
  amount_base_units: baseUnits,
  maximum_fee_base_units: baseUnits,
  mode: z.enum(['fakerpc', 'live']),
  recipient: z.string().optional(),
  evidence_revision: z.number().nullable().optional(),
});
export type ChainPreview = z.infer<typeof chainPreviewSchema>;

export const operationSchema = z.object({
  id: z.string(),
  status: opStatus,
  action: z.string().optional(),
  unsigned_xdr: z.string().nullable().optional(),
  preview: chainPreviewSchema.nullable().optional(),
  error_code: z.string().nullable().optional(),
});
export type Operation = z.infer<typeof operationSchema>;

export const openOperationSchema = z.object({ operation: operationSchema.nullable() });

