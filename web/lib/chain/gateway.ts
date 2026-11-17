import "server-only";
import { ChainError } from "./constants";
import { FakeRpc, type AwardSnapshot, type PreparedEnvelope, type RpcGateway } from "./rpc";
import { LiveRpc } from "./live";

export function isFakeRpc(): boolean {
  if (process.env.STELLAR_USE_FAKE_RPC === "1") return true;
  if (process.env.STELLAR_USE_FAKE_RPC === "0") return false;
  // Default: FakeRpc until WASM hash is configured for live Testnet.
  return !process.env.STELLAR_WASM_HASH;
}

export function createRpc(snapshot: AwardSnapshot): RpcGateway {
  if (isFakeRpc()) return new FakeRpc(snapshot);
  return new LiveRpc();
}

export type { AwardSnapshot, PreparedEnvelope, RpcGateway };
export { ChainError };
