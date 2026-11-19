import { requireOptionalNativeModule } from 'expo';

type FundoraSigner = {
  /** `ok:<secret S…>:<public G…>` or `err:<message>`. */
  generate(): string;
  /** `ok:<public G…>` or `err:<message>`. */
  publicKey(secret: string): string;
  /** `ok:<signed envelope, base64 XDR>` or `err:<message>`; the checks live in rust/src/lib.rs. */
  signAwardCall(
    envelope: string,
    networkPassphrase: string,
    signer: string,
    action: string,
    maxFee: string,
    nowSeconds: number,
    secret: string,
  ): string;
};

/** The Rust signer, or null where it is not built: Expo Go, iOS (needs a Mac to build) and web. */
export default requireOptionalNativeModule<FundoraSigner>('FundoraSigner');
