import * as SecureStore from 'expo-secure-store';

import type { ChainPreview } from '@/lib/api/schemas';

import Signer from '../../../modules/fundora-signer';

const SECRET = 'fundora.wallet_secret';
const ADDRESS = 'fundora.wallet_address';

// Each read of the secret needs fingerprint or face unlock (both platforms are biometric-only here),
// and neither item leaves this device through backups or device transfer.
const guarded: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Unlock your Fundora Testnet wallet',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};
const local: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** Key generation and signing run in Rust (modules/fundora-signer); absent in Expo Go, on iOS and on web. */
export const walletSupported = Signer !== null;

const UNSUPPORTED = 'The phone wallet needs the Fundora Android app build. It is not available in Expo Go or on iOS yet.';

/** The Rust signer answers `ok:<value>` or `err:<message>`; its message is shown unchanged. */
function unwrap(result: string): string {
  if (result.startsWith('ok:')) return result.slice(3);
  throw new Error(result.startsWith('err:') ? result.slice(4) : 'The wallet signer failed. Nothing was signed.');
}

/** The public G… address; reading it needs no unlock. */
export const getWalletAddress = () => SecureStore.getItemAsync(ADDRESS, local);

export const canCreateWallet = () => walletSupported && SecureStore.canUseBiometricAuthentication();

export async function createWallet(): Promise<string> {
  if (!Signer) throw new Error(UNSUPPORTED);
  if (await getWalletAddress()) throw new Error('This phone already has a Fundora wallet.');
  const [secret, address] = unwrap(Signer.generate()).split(':');
  await SecureStore.setItemAsync(SECRET, secret, guarded);
  await SecureStore.setItemAsync(ADDRESS, address, local);
  return address;
}

// shortcut: no export or backup — losing the phone or re-enrolling biometrics loses this Testnet wallet.
// Add an encrypted recovery phrase before this wallet is ever allowed near Mainnet.
export async function deleteWallet() {
  await SecureStore.deleteItemAsync(SECRET, guarded);
  await SecureStore.deleteItemAsync(ADDRESS, local);
}

async function unlock(): Promise<string> {
  let secret: string | null;
  try {
    secret = await SecureStore.getItemAsync(SECRET, guarded);
  } catch {
    throw new Error('Wallet unlock was cancelled or failed. Nothing was signed.');
  }
  if (secret) return secret;
  // Address without key: biometrics were re-enrolled, or the address came back from a restore without the key.
  if (await getWalletAddress()) {
    throw new Error(
      "This phone's wallet key is no longer available (fingerprint or face unlock changed). Delete the wallet on the Account tab, create a new one and ask your program administrator to link it. Nothing was signed.",
    );
  }
  throw new Error('There is no wallet on this phone. Create one on the Account tab.');
}

/**
 * Unlocks the wallet (biometric prompt) and returns the signed envelope for /operations/:id/submit.
 * The Rust signer refuses anything but the exact award-contract call the preview describes.
 */
export async function signOperation(unsignedXdr: string, preview: ChainPreview, now = Date.now()): Promise<string> {
  if (!Signer) throw new Error(UNSUPPORTED);
  const secret = await unlock();
  if (unwrap(Signer.publicKey(secret)) !== preview.signer) {
    throw new Error('This award expects a different wallet than the one on this phone. Nothing was signed.');
  }
  // A local FakeRpc server prepares placeholder envelopes; it still requires the unlock above.
  if (preview.mode === 'fakerpc') return `SIGNED-${unsignedXdr}`;
  return unwrap(
    Signer.signAwardCall(
      unsignedXdr,
      preview.network_passphrase,
      preview.signer,
      preview.action,
      preview.maximum_fee_base_units,
      Math.floor(now / 1000),
      secret,
    ),
  );
}
