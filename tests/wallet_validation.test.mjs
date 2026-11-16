import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const output=await build({entryPoints:['static_src/wallet_validation.ts'],bundle:true,write:false,format:'esm'});
const {requireAssignedWallet}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
test('wrong account is rejected before signing',()=>assert.throws(()=>requireAssignedWallet('other','assigned','test','test'),/assigned wallet/));
test('wrong network is rejected before signing',()=>assert.throws(()=>requireAssignedWallet('assigned','assigned','public','test'),/Testnet/));
test('assigned Testnet wallet is allowed',()=>assert.doesNotThrow(()=>requireAssignedWallet('assigned','assigned','test','test')));
