import { createHash, randomBytes } from "node:crypto";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "./constants";

const NETWORK = NETWORK_PASSPHRASE || Networks.TESTNET;

/** Port of proofpay.chain.constructor_manifest */
export function constructorManifest(args: {
  existing?: Record<string, unknown> | null;
  sponsorWallet: string;
  verifierWallet: string;
  recipientWallet: string;
  requirementsText: string;
  requirementsVersion: number;
  claimDeadline: Date;
  reviewDeadline: Date;
  payoutDeadline: Date;
}): Record<string, unknown> {
  if (args.existing && Object.keys(args.existing).length) {
    return args.existing;
  }
  const nonce = randomBytes(32).toString("hex");
  const policy = Buffer.from(
    JSON.stringify({
      nonce,
      requirements: args.requirementsText,
      version: args.requirementsVersion,
    }),
    "utf8",
  );
  // Django uses sort_keys=True — rebuild with sorted keys:
  const policySorted = Buffer.from(
    JSON.stringify({
      nonce,
      requirements: args.requirementsText,
      version: args.requirementsVersion,
    }),
    "utf8",
  );
  void policy;
  return {
    sponsor: args.sponsorWallet,
    verifier: args.verifierWallet,
    recipient: args.recipientWallet,
    token: Asset.native().contractId(NETWORK),
    amount: 200000000,
    award_id: randomBytes(32).toString("hex"),
    policy_hash: createHash("sha256").update(policySorted).digest("hex"),
    policy_nonce: nonce,
    requirements_text: args.requirementsText,
    claim_deadline: Math.floor(args.claimDeadline.getTime() / 1000),
    review_deadline: Math.floor(args.reviewDeadline.getTime() / 1000),
    payout_deadline: Math.floor(args.payoutDeadline.getTime() / 1000),
    salt: randomBytes(32).toString("hex"),
  };
}
