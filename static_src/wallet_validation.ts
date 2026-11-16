export function requireAssignedWallet(actualAddress:string, expectedAddress:string, actualNetwork:string, expectedNetwork:string):void {
  if(actualAddress!==expectedAddress) throw new Error("Select the assigned wallet account before signing.");
  if(actualNetwork!==expectedNetwork) throw new Error("Switch your wallet to Stellar Testnet before signing.");
}
