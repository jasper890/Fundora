import {requireAssignedWallet} from "./wallet_validation";
import {getNetwork, requestAccess, signTransaction} from "@stellar/freighter-api";
export {getNetwork, isConnected, requestAccess, signTransaction} from "@stellar/freighter-api";

type Prepared = {operation_id:string; unsigned_xdr:string; preview:Record<string,string|number|null>; status:string};
type Outcome = {operation_id:string; status:string; transaction_hash:string|null; error_code:string|null};
const host = document.querySelector<HTMLElement>("[data-chain-workspace]");
if (host) {
  const form = host.querySelector<HTMLFormElement>("[data-prepare]")!;
  const message = host.querySelector<HTMLElement>("[data-chain-message]")!;
  const preview = host.querySelector<HTMLElement>("[data-preview]")!;
  const details = host.querySelector<HTMLDListElement>("[data-preview-details]")!;
  const sign = host.querySelector<HTMLButtonElement>("[data-sign]")!;
  const cancel = host.querySelector<HTMLButtonElement>("[data-cancel]")!;
  let prepared:Prepared|null=null;
  let submitAttempted=false;
  let intentKey:string|null=null;
  const token=host.querySelector<HTMLInputElement>("[name=csrfmiddlewaretoken]")!.value;
  async function api<T>(url:string, data?:unknown, key?:string, timeout=10000):Promise<T> {
    const response=await fetch(url,{method:data===undefined?"GET":"POST",credentials:"same-origin",signal:AbortSignal.timeout(timeout),headers:{"Content-Type":"application/json","X-CSRFToken":token,...(key?{"Idempotency-Key":key}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error||"Request unavailable. Refresh status before retrying.");
    return result as T;
  }
  function describe(result:Outcome):string {
    if(result.status==="CONFIRMED_SUCCESS") return `Action confirmed. Transaction: ${result.transaction_hash}. Refresh the award to see its confirmed state.`;
    if(result.status==="CONFIRMED_FAILED") return "Transaction failed on-chain. Refresh the award before preparing another action.";
    if(result.status==="ABANDONED") return "Unsigned request cancelled. You can review another action.";
    return `Outcome not confirmed (${result.status}). Refresh status before attempting another action.`;
  }
  async function refresh(id:string, timeout=10000) {
    const result=await api<Outcome>(`/operations/${id}/`,undefined,undefined,timeout);
    message.textContent=describe(result);
    return result;
  }
  form.addEventListener("change",()=>{if(!prepared&&!submitAttempted)intentKey=null;});
  host.querySelector<HTMLButtonElement>("[data-refresh-current]")?.addEventListener("click",async()=>{if(prepared)try{await refresh(prepared.operation_id);}catch{message.textContent="Status unavailable. Outcome remains unconfirmed.";}});
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const button=form.querySelector<HTMLButtonElement>("button")!;
    button.disabled=true;
    const data=new FormData(form);
    const action=String(data.get("action"));
    const params:Record<string,unknown>={};
    if(action==="SUBMIT") params.evidence_id=host.dataset.evidenceId;
    if(action==="SET_HOLD") params.held=data.get("held")==="true";
    if(action==="REPLACE_VERIFIER") params.new_verifier_member_id=Number(data.get("new_verifier_member_id"));
    const body:Record<string,unknown>={params};
    if(!["DEPLOY","EXTEND_TTL"].includes(action)) body.expected_version=host.dataset.version;
    intentKey ||= crypto.randomUUID();
    try {
      prepared=await api<Prepared>(`${host.dataset.prepareBase}${action.toLowerCase()}/`,body,intentKey);
      submitAttempted=false;
      details.replaceChildren();
      for(const [key,value] of Object.entries(prepared.preview)) {
        const labels:Record<string,string>={action:"Action",network:"Network",network_passphrase:"Network passphrase",signer:"Signing wallet",recipient:"Assigned recipient",asset:"Asset",amount_base_units:"Award amount",maximum_fee_base_units:"Maximum network fee",expected_version:"Award version",evidence_revision:"Evidence revision",expires_at:"Signing deadline (UTC)",claim_deadline:"Evidence deadline (UTC)",review_deadline:"Review deadline (UTC)",payout_deadline:"Payment deadline (UTC)",transfer_from:"Transfer from",transfer_to:"Transfer to"};
        const dt=document.createElement("dt");dt.textContent=labels[key]||key.replaceAll("_"," ");
        const dd=document.createElement("dd");dd.textContent=["amount_base_units","maximum_fee_base_units"].includes(key)?`${Number(value)/10000000} Testnet XLM`:String(value??"Not applicable");
        details.append(dt,dd);
      }
      preview.hidden=false;sign.disabled=false;cancel.disabled=false;
      message.textContent="Review the exact action below. Signing does not confirm payment.";
      sign.focus();
    }catch(error){message.textContent=String(error);button.disabled=false;}
  });
  cancel.addEventListener("click",async()=>{
    if(!prepared||submitAttempted)return;
    try {await api(`/operations/${prepared.operation_id}/abandon/`,{});prepared=null;preview.hidden=true;intentKey=null;form.querySelector<HTMLButtonElement>("button")!.disabled=false;message.textContent="Unsigned request cancelled.";}catch(error){message.textContent=String(error);}
  });
  sign.addEventListener("click",async()=>{
    if(!prepared||submitAttempted)return;
    sign.disabled=true;
    try {
      const access=await requestAccess();
      if(access.error||access.address!==prepared.preview.signer) throw new Error("Select the assigned wallet account before signing.");
      const network=await getNetwork();
      if(network.error) throw new Error("Wallet network is unavailable.");
      requireAssignedWallet(access.address,String(prepared.preview.signer),network.networkPassphrase,String(prepared.preview.network_passphrase));
      const signed=await signTransaction(prepared.unsigned_xdr,{address:String(prepared.preview.signer),networkPassphrase:String(prepared.preview.network_passphrase)});
      if(signed.error||!signed.signedTxXdr) throw new Error("Wallet signing was declined or unavailable. You can retry or cancel this unsigned request.");
      if(signed.signerAddress!==prepared.preview.signer) throw new Error("The wallet returned a different signing account.");
      submitAttempted=true;cancel.disabled=true;
      message.textContent="Submitting signed request. Outcome is not yet confirmed.";
      await api<Outcome>(`/operations/${prepared.operation_id}/submit/`,{signed_xdr:signed.signedTxXdr});
      const end=Date.now()+60_000;
      let delay=1000;
      while(Date.now()<end) {
        const result=await refresh(prepared.operation_id,Math.max(1,Math.min(10000,end-Date.now())));
        if(result.status.startsWith("CONFIRMED")) return;
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,Math.min(delay,end-Date.now()))));delay=Math.min(delay*2,8000);
      }
      message.textContent="Outcome not confirmed. Use Refresh status; do not prepare a duplicate action.";
    }catch(error){message.textContent=submitAttempted?"Submission outcome is unknown. Refresh status before trying anything else.":String(error);if(!submitAttempted)sign.disabled=false;}
  });
  host.querySelectorAll<HTMLButtonElement>("[data-refresh-operation]").forEach(button=>button.addEventListener("click",async()=>{
    button.disabled=true;try{await refresh(button.dataset.refreshOperation!);}catch{message.textContent="Status unavailable. Last confirmed award state is unchanged.";}finally{button.disabled=false;}
  }));
}
