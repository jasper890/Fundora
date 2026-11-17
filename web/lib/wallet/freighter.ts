"use client";

import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

export async function freighterAvailable(): Promise<boolean> {
  try {
    const result = await isConnected();
    return Boolean(result.isConnected);
  } catch {
    return false;
  }
}

export async function freighterConnect(): Promise<{
  address: string;
  network: string;
}> {
  const access = await requestAccess();
  if (access.error || !access.address) {
    throw new Error(access.error?.message || "Freighter access was declined.");
  }
  const network = await getNetwork();
  if (network.error) {
    throw new Error(network.error.message || "Could not read Freighter network.");
  }
  return {
    address: access.address,
    network: network.network || network.networkPassphrase || "",
  };
}

export async function freighterCurrentAddress(): Promise<string | null> {
  try {
    const result = await getAddress();
    if (result.error || !result.address) return null;
    return result.address;
  } catch {
    return null;
  }
}

export async function freighterSign(
  unsignedXdr: string,
  networkPassphrase: string,
): Promise<string> {
  const result = await signTransaction(unsignedXdr, {
    networkPassphrase,
    address: (await getAddress()).address,
  });
  if (result.error || !result.signedTxXdr) {
    throw new Error(result.error?.message || "Freighter signing was declined.");
  }
  return result.signedTxXdr;
}
