// The signing rules themselves are tested in Rust (modules/fundora-signer/rust/src/tests.rs).
// These tests cover the app side: biometric unlock first, wallet match, and the Rust result passed through.
import * as SecureStore from 'expo-secure-store';

import type { ChainPreview } from '@/lib/api/schemas';

import { signOperation } from './wallet';

jest.mock('../../../modules/fundora-signer', () => ({
  __esModule: true,
  default: { generate: jest.fn(), publicKey: jest.fn(), signAwardCall: jest.fn() },
}));
const mockNative = jest.requireMock('../../../modules/fundora-signer').default as Record<
  'generate' | 'publicKey' | 'signAwardCall',
  jest.Mock
>;
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  canUseBiometricAuthentication: () => true,
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 1,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 2,
}));
const getItem = SecureStore.getItemAsync as jest.Mock;

const preview: ChainPreview = {
  action: 'SUBMIT',
  network_passphrase: 'Test SDF Network ; September 2015',
  signer: 'GME',
  amount_base_units: '200000000',
  maximum_fee_base_units: '50000',
  mode: 'live',
};

beforeEach(() => {
  jest.clearAllMocks();
  getItem.mockImplementation(async (key: string) => (key === 'fundora.wallet_secret' ? 'SSECRET' : 'GME'));
  mockNative.publicKey.mockReturnValue('ok:GME');
});

test('unlocks with biometrics, then hands the exact preview to the Rust signer', async () => {
  mockNative.signAwardCall.mockReturnValue('ok:SIGNED_XDR');
  await expect(signOperation('XDR', preview, 1_795_000_000_000)).resolves.toBe('SIGNED_XDR');
  expect(getItem).toHaveBeenCalledWith('fundora.wallet_secret', expect.objectContaining({ requireAuthentication: true }));
  expect(mockNative.signAwardCall).toHaveBeenCalledWith(
    'XDR',
    preview.network_passphrase,
    'GME',
    'SUBMIT',
    '50000',
    1_795_000_000,
    'SSECRET',
  );
});

test("shows the Rust signer's refusal unchanged", async () => {
  mockNative.signAwardCall.mockReturnValue('err:The network fee does not match the preview. Nothing was signed.');
  await expect(signOperation('XDR', preview)).rejects.toThrow('The network fee does not match the preview.');
});

test('refuses a different wallet and a cancelled unlock before anything is signed', async () => {
  mockNative.publicKey.mockReturnValue('ok:GOTHER');
  await expect(signOperation('XDR', preview)).rejects.toThrow(/different wallet/);
  getItem.mockRejectedValueOnce(new Error('cancelled'));
  await expect(signOperation('XDR', preview)).rejects.toThrow(/cancelled or failed/);
  expect(mockNative.signAwardCall).not.toHaveBeenCalled();
});

test('the local FakeRpc server still needs the unlock but gets no real signature', async () => {
  await expect(signOperation('FAKE-PAY', { ...preview, mode: 'fakerpc' })).resolves.toBe('SIGNED-FAKE-PAY');
  expect(getItem).toHaveBeenCalled();
  expect(mockNative.signAwardCall).not.toHaveBeenCalled();
});
