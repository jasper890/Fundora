//! Testnet-only Stellar signer for the Fundora phone wallet (ADR-0003).
//!
//! The server prepares every transaction, so it is not trusted here: [`sign_award_call`] signs only one call to
//! the award contract's `submit`, `approve` or `pay`, on Testnet, from the wallet, with the previewed fee and a
//! short expiry, and with no authorization beyond that call. Anything else could move the wallet's funds or hand
//! over the account.

use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};
use stellar_strkey::ed25519::{PrivateKey, PublicKey};
use stellar_xdr::{
    DecoratedSignature, HostFunction, Limits, MuxedAccount, OperationBody, Preconditions, ReadXdr, ScAddress,
    Signature, SignatureHint, SorobanAuthorizedFunction, SorobanCredentials, TransactionEnvelope, WriteXdr,
};

pub const TESTNET_PASSPHRASE: &str = "Test SDF Network ; September 2015";
/// Far above any real Soroban fee for these calls, far below anything that could drain a wallet (10 XLM).
pub const MAX_FEE_STROOPS: u32 = 100_000_000;
pub const MAX_VALIDITY_SECONDS: u64 = 15 * 60;

/// The award-contract method each phone-signed action must call (see contracts/award/src/lib.rs).
fn method_for(action: &str) -> Option<&'static str> {
    match action {
        "SUBMIT" => Some("submit"),
        "APPROVE" => Some("approve"),
        "PAY" => Some("pay"),
        _ => None,
    }
}

fn public_str(bytes: [u8; 32]) -> String {
    PublicKey(bytes).to_string().as_str().to_owned()
}

/// Encodes the secret as `S…`; only for handing it back to the phone's secure storage.
fn secret_str(bytes: [u8; 32]) -> String {
    PrivateKey(bytes).as_unredacted().to_string().as_str().to_owned()
}

fn refuse(reason: &str) -> String {
    format!("{reason} Nothing was signed.")
}

/// A new key pair from the operating system's secure random generator: (secret `S…`, public `G…`).
pub fn generate() -> Result<(String, String), String> {
    let mut seed = [0u8; 32];
    getrandom::fill(&mut seed).map_err(|_| "The phone's secure random generator is unavailable.".to_string())?;
    let key = SigningKey::from_bytes(&seed);
    seed.fill(0);
    Ok((secret_str(key.to_bytes()), public_str(key.verifying_key().to_bytes())))
}

fn signing_key(secret: &str) -> Result<SigningKey, String> {
    let seed = PrivateKey::from_string(secret).map_err(|_| refuse("The wallet secret is not a valid Stellar key."))?;
    Ok(SigningKey::from_bytes(&seed.0))
}

/// The `G…` address for a secret `S…` key.
pub fn public_key(secret: &str) -> Result<String, String> {
    Ok(public_str(signing_key(secret)?.verifying_key().to_bytes()))
}

/// What the server's preview claims; every field is checked against the envelope itself.
pub struct Preview<'a> {
    pub network_passphrase: &'a str,
    pub signer: &'a str,
    pub action: &'a str,
    pub max_fee: &'a str,
}

/// Signs `envelope_b64` with `secret` only if it is exactly the award-contract call `preview` describes.
pub fn sign_award_call(envelope_b64: &str, preview: &Preview, secret: &str, now_seconds: u64) -> Result<String, String> {
    if preview.network_passphrase != TESTNET_PASSPHRASE {
        return Err(refuse("This wallet only signs Stellar Testnet transactions."));
    }
    let key = signing_key(secret)?;
    let signer = PublicKey(key.verifying_key().to_bytes());
    if preview.signer != public_str(signer.0) {
        return Err(refuse("This award expects a different wallet than the one on this phone."));
    }
    let method = method_for(preview.action).ok_or_else(|| refuse("This action is signed on the web, not on the phone."))?;

    let envelope = TransactionEnvelope::from_xdr_base64(envelope_b64, Limits::len(200_000))
        .map_err(|_| refuse("The prepared transaction could not be read."))?;
    // A fee bump or a legacy V0 envelope is never what the server prepares for these actions.
    let TransactionEnvelope::Tx(mut v1) = envelope else {
        return Err(refuse("The prepared transaction does not come from your wallet."));
    };
    let tx = &v1.tx;
    if tx.source_account != MuxedAccount::Ed25519(signer.0.into()) || !v1.signatures.is_empty() {
        return Err(refuse("The prepared transaction does not come from your wallet."));
    }

    let [op] = tx.operations.as_slice() else {
        return Err(refuse("The prepared transaction is not a single award-contract call."));
    };
    if op.source_account.as_ref().is_some_and(|s| *s != tx.source_account) {
        return Err(refuse("The prepared transaction is not a single award-contract call."));
    }
    let OperationBody::InvokeHostFunction(invoke) = &op.body else {
        return Err(refuse("The prepared transaction is not a single award-contract call."));
    };
    let HostFunction::InvokeContract(call) = &invoke.host_function else {
        return Err(refuse(&format!("The prepared transaction does not call \"{method}\".")));
    };
    if call.function_name.0.as_slice() != method.as_bytes() || !matches!(call.contract_address, ScAddress::Contract(_)) {
        return Err(refuse(&format!("The prepared transaction does not call \"{method}\".")));
    }
    for entry in invoke.auth.iter() {
        let root = &entry.root_invocation;
        let same_call = matches!(&root.function, SorobanAuthorizedFunction::ContractFn(f)
            if f.contract_address == call.contract_address && f.function_name.0.as_slice() == method.as_bytes());
        if !matches!(entry.credentials, SorobanCredentials::SourceAccount) || !root.sub_invocations.is_empty() || !same_call {
            return Err(refuse("The prepared transaction asks for permissions beyond this award action."));
        }
    }

    if preview.max_fee != tx.fee.to_string() || tx.fee > MAX_FEE_STROOPS {
        return Err(refuse("The network fee does not match the preview."));
    }
    let max_time = match &tx.cond {
        Preconditions::Time(bounds) => bounds.max_time.0,
        Preconditions::V2(v2) => v2.time_bounds.as_ref().map_or(0, |bounds| bounds.max_time.0),
        Preconditions::None => 0,
    };
    if max_time == 0 || max_time > now_seconds + MAX_VALIDITY_SECONDS {
        return Err(refuse("The transaction has no short expiry."));
    }

    let network_id: [u8; 32] = Sha256::digest(TESTNET_PASSPHRASE.as_bytes()).into();
    let hash = v1.hash(network_id).map_err(|_| refuse("The prepared transaction could not be hashed."))?;
    let signature = key.sign(&hash).to_bytes();
    let hint: [u8; 4] = signer.0[28..].try_into().expect("ed25519 keys are 32 bytes");
    let decorated = DecoratedSignature {
        hint: SignatureHint(hint),
        signature: Signature(signature.to_vec().try_into().expect("ed25519 signatures are 64 bytes")),
    };
    v1.signatures = vec![decorated].try_into().expect("one signature fits");
    TransactionEnvelope::Tx(v1)
        .to_xdr_base64(Limits::none())
        .map_err(|_| refuse("The signed transaction could not be encoded."))
}

#[cfg(target_os = "android")]
mod android {
    //! JNI entry points for `expo.modules.fundorasigner.RustSigner` (Kotlin). Results come back as
    //! `ok:<value>` or `err:<message>` so the app shows the Rust message unchanged.
    use jni::objects::{JObject, JString};
    use jni::sys::{jdouble, jstring};
    use jni::JNIEnv;

    fn reply(env: &mut JNIEnv, result: Result<String, String>) -> jstring {
        let text = match result {
            Ok(value) => format!("ok:{value}"),
            Err(message) => format!("err:{message}"),
        };
        env.new_string(text).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut())
    }

    fn arg(env: &mut JNIEnv, value: &JString) -> String {
        env.get_string(value).map(Into::into).unwrap_or_default()
    }

    #[no_mangle]
    pub extern "system" fn Java_expo_modules_fundorasigner_RustSigner_generate(mut env: JNIEnv, _this: JObject) -> jstring {
        let result = super::generate().map(|(secret, public)| format!("{secret}:{public}"));
        reply(&mut env, result)
    }

    #[no_mangle]
    pub extern "system" fn Java_expo_modules_fundorasigner_RustSigner_publicKey(
        mut env: JNIEnv,
        _this: JObject,
        secret: JString,
    ) -> jstring {
        let secret = arg(&mut env, &secret);
        let result = super::public_key(&secret);
        reply(&mut env, result)
    }

    #[no_mangle]
    #[allow(clippy::too_many_arguments)]
    pub extern "system" fn Java_expo_modules_fundorasigner_RustSigner_signAwardCall(
        mut env: JNIEnv,
        _this: JObject,
        envelope: JString,
        passphrase: JString,
        signer: JString,
        action: JString,
        max_fee: JString,
        now_seconds: jdouble,
        secret: JString,
    ) -> jstring {
        let (envelope, passphrase, signer, action, max_fee, secret) = (
            arg(&mut env, &envelope),
            arg(&mut env, &passphrase),
            arg(&mut env, &signer),
            arg(&mut env, &action),
            arg(&mut env, &max_fee),
            arg(&mut env, &secret),
        );
        let preview = super::Preview { network_passphrase: &passphrase, signer: &signer, action: &action, max_fee: &max_fee };
        let result = super::sign_award_call(&envelope, &preview, &secret, now_seconds as u64);
        reply(&mut env, result)
    }
}

#[cfg(test)]
mod tests;
