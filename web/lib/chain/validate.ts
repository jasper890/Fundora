import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { ChainError, FEE_CEILING, NETWORK_PASSPHRASE } from "./constants";

export function validateSignedEnvelope(
  operation: { unsigned_xdr: unknown; unsigned_hash: unknown; signer: unknown },
  signedXdr: string,
): string {
  let prepared;
  let signed;
  try {
    prepared = TransactionBuilder.fromXdr(String(operation.unsigned_xdr), NETWORK_PASSPHRASE);
    signed = TransactionBuilder.fromXdr(signedXdr, NETWORK_PASSPHRASE);
  } catch {
    throw new ChainError("INVALID_TRANSACTION", 422);
  }
  if (
    !(prepared instanceof Transaction) || !(signed instanceof Transaction) ||
    prepared.signatures.length !== 0 ||
    Buffer.from(prepared.hash()).toString("hex") !== operation.unsigned_hash ||
    !Buffer.from(prepared.signatureBase()).equals(Buffer.from(signed.signatureBase())) ||
    signed.source !== operation.signer || signed.operations.length !== 1 ||
    signed.operations[0].type !== "invokeHostFunction" ||
    BigInt(signed.fee) > BigInt(FEE_CEILING)
  ) throw new ChainError("TRANSACTION_MISMATCH", 422);

  const signatures = signed.signatures;
  try {
    const key = Keypair.fromPublicKey(String(operation.signer));
    if (signatures.length !== 1 || !key.verify(signed.hash(), signatures[0].signature)) {
      throw new Error("signature");
    }
  } catch {
    throw new ChainError("INVALID_SIGNATURE", 422);
  }
  return Buffer.from(signed.hash()).toString("hex");
}
