use super::*;
use ed25519_dalek::{Signature as EdSignature, Verifier, VerifyingKey};
use stellar_xdr::{
    BumpSequenceOp, ContractId, Hash, InvokeContractArgs, InvokeHostFunctionOp, Memo, Operation, ScSymbol,
    SequenceNumber, SorobanAuthorizationEntry, SorobanAuthorizedInvocation, TimeBounds, TimePoint, Transaction,
    TransactionExt, TransactionV1Envelope,
};

const NOW: u64 = 1_795_000_000;
const PASSPHRASE_PUBLIC: &str = "Public Global Stellar Network ; September 2015";

fn secret(fill: u8) -> String {
    secret_str([fill; 32])
}

fn address(fill: u8) -> MuxedAccount {
    MuxedAccount::Ed25519(SigningKey::from_bytes(&[fill; 32]).verifying_key().to_bytes().into())
}

fn contract(fill: u8) -> ScAddress {
    ScAddress::Contract(ContractId(Hash([fill; 32])))
}

fn call(contract_fill: u8, method: &str) -> InvokeContractArgs {
    InvokeContractArgs {
        contract_address: contract(contract_fill),
        function_name: ScSymbol(method.try_into().unwrap()),
        args: vec![].try_into().unwrap(),
    }
}

fn auth(contract_fill: u8, method: &str, nested: Option<SorobanAuthorizedInvocation>) -> SorobanAuthorizationEntry {
    SorobanAuthorizationEntry {
        credentials: SorobanCredentials::SourceAccount,
        root_invocation: SorobanAuthorizedInvocation {
            function: SorobanAuthorizedFunction::ContractFn(call(contract_fill, method)),
            sub_invocations: nested.into_iter().collect::<Vec<_>>().try_into().unwrap(),
        },
    }
}

struct Shape {
    source: u8,
    method: &'static str,
    auth: Vec<SorobanAuthorizationEntry>,
    extra_op: bool,
    fee: u32,
    max_time: u64,
}

impl Default for Shape {
    fn default() -> Self {
        Shape { source: 7, method: "submit", auth: vec![auth(1, "submit", None)], extra_op: false, fee: 50_000, max_time: NOW + 300 }
    }
}

fn envelope(shape: Shape) -> String {
    let mut operations = vec![Operation {
        source_account: None,
        body: OperationBody::InvokeHostFunction(InvokeHostFunctionOp {
            host_function: HostFunction::InvokeContract(call(1, shape.method)),
            auth: shape.auth.try_into().unwrap(),
        }),
    }];
    if shape.extra_op {
        operations.push(Operation {
            source_account: None,
            body: OperationBody::BumpSequence(BumpSequenceOp { bump_to: SequenceNumber(99) }),
        });
    }
    let tx = Transaction {
        source_account: address(shape.source),
        fee: shape.fee,
        seq_num: SequenceNumber(2),
        cond: Preconditions::Time(TimeBounds { min_time: TimePoint(0), max_time: TimePoint(shape.max_time) }),
        memo: Memo::None,
        operations: operations.try_into().unwrap(),
        ext: TransactionExt::V0,
    };
    TransactionEnvelope::Tx(TransactionV1Envelope { tx, signatures: vec![].try_into().unwrap() })
        .to_xdr_base64(Limits::none())
        .unwrap()
}

fn preview<'a>(signer: &'a str, action: &'a str, max_fee: &'a str) -> Preview<'a> {
    Preview { network_passphrase: TESTNET_PASSPHRASE, signer, action, max_fee }
}

fn sign(shape: Shape, action: &str, max_fee: &str) -> Result<String, String> {
    let me = public_key(&secret(7)).unwrap();
    sign_award_call(&envelope(shape), &preview(&me, action, max_fee), &secret(7), NOW)
}

/// The signature in a signed envelope, checked against the Testnet transaction hash.
fn verifies(signed_b64: &str, signer_fill: u8) -> bool {
    let TransactionEnvelope::Tx(v1) = TransactionEnvelope::from_xdr_base64(signed_b64, Limits::none()).unwrap() else {
        return false;
    };
    let network_id: [u8; 32] = Sha256::digest(TESTNET_PASSPHRASE.as_bytes()).into();
    let hash = v1.hash(network_id).unwrap();
    let key: VerifyingKey = SigningKey::from_bytes(&[signer_fill; 32]).verifying_key();
    let [sig] = v1.signatures.as_slice() else { return false };
    let bytes: [u8; 64] = sig.signature.0.as_slice().try_into().unwrap();
    key.verify(&hash, &EdSignature::from_bytes(&bytes)).is_ok() && sig.hint.0 == key.to_bytes()[28..]
}

#[test]
fn generates_a_valid_stellar_key_pair() {
    let (secret, public) = generate().unwrap();
    assert!(secret.starts_with('S') && public.starts_with('G'));
    assert_eq!(public_key(&secret).unwrap(), public);
    assert_ne!(generate().unwrap().0, secret, "two wallets never share a key");
}

#[test]
fn signs_exactly_the_expected_award_call_with_a_valid_signature() {
    let signed = sign(Shape::default(), "SUBMIT", "50000").unwrap();
    assert!(verifies(&signed, 7));
    assert!(sign(Shape { method: "approve", auth: vec![auth(1, "approve", None)], ..Shape::default() }, "APPROVE", "50000").is_ok());
    assert!(sign(Shape { method: "pay", auth: vec![auth(1, "pay", None)], ..Shape::default() }, "PAY", "50000").is_ok());
}

/// Fixture built by the website's @stellar/stellar-sdk 17.4 (seed 0x07…, contract 0x01…, `submit`, fee 50000).
/// Same hash on both sides means a Rust signature is valid for the Stellar network and for the server's checks.
#[test]
fn matches_the_javascript_sdk_hash_for_the_same_envelope() {
    let xdr = "AAAAAgAAAADqSmxj4pxSCr71UHsTLsX5lUd2rr6+e5JCHuppFEbSLAAAw1AAAAAAAAAAAgAAAAEAAAAAAAAAAAAAAABq/YfsAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAAAGc3VibWl0AAAAAAAAAAAAAQAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAAABnN1Ym1pdAAAAAAAAAAAAAAAAAAAAAAAAA==";
    let js_hash = "ba99f8b2bf424b291f869d738760abc66d24815ec0b8259b1687e454e9f973e3";
    let me = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57";
    assert_eq!(public_key(&secret(7)).unwrap(), me);
    assert_eq!(envelope(Shape { max_time: 1_795_000_300, ..Shape::default() }), xdr, "same bytes as the JS SDK");
    let TransactionEnvelope::Tx(v1) = TransactionEnvelope::from_xdr_base64(xdr, Limits::none()).unwrap() else { panic!() };
    let network_id: [u8; 32] = Sha256::digest(TESTNET_PASSPHRASE.as_bytes()).into();
    let hash: String = v1.hash(network_id).unwrap().iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(hash, js_hash);
    let signed = sign_award_call(xdr, &preview(me, "SUBMIT", "50000"), &secret(7), 1_795_000_000).unwrap();
    assert!(verifies(&signed, 7));
}

#[test]
fn refuses_any_network_other_than_testnet() {
    let me = public_key(&secret(7)).unwrap();
    let mainnet = Preview { network_passphrase: PASSPHRASE_PUBLIC, ..preview(&me, "SUBMIT", "50000") };
    let err = sign_award_call(&envelope(Shape::default()), &mainnet, &secret(7), NOW).unwrap_err();
    assert!(err.contains("only signs Stellar Testnet"), "{err}");
}

#[test]
fn refuses_another_source_account_or_another_expected_wallet() {
    assert!(sign(Shape { source: 9, ..Shape::default() }, "SUBMIT", "50000").unwrap_err().contains("does not come from your wallet"));
    let other = public_key(&secret(9)).unwrap();
    let err = sign_award_call(&envelope(Shape::default()), &preview(&other, "SUBMIT", "50000"), &secret(7), NOW).unwrap_err();
    assert!(err.contains("different wallet"), "{err}");
}

#[test]
fn refuses_web_only_actions_and_a_different_method() {
    assert!(sign(Shape { method: "fund", ..Shape::default() }, "FUND", "50000").unwrap_err().contains("signed on the web"));
    assert!(sign(Shape { method: "refund", ..Shape::default() }, "SUBMIT", "50000").unwrap_err().contains("does not call \"submit\""));
}

#[test]
fn refuses_extra_operations() {
    let err = sign(Shape { extra_op: true, ..Shape::default() }, "SUBMIT", "50000").unwrap_err();
    assert!(err.contains("single award-contract call"), "{err}");
}

#[test]
fn refuses_auth_beyond_the_call() {
    let other_contract = Shape { auth: vec![auth(2, "submit", None)], ..Shape::default() };
    assert!(sign(other_contract, "SUBMIT", "50000").unwrap_err().contains("permissions beyond"));
    let other_method = Shape { auth: vec![auth(1, "refund", None)], ..Shape::default() };
    assert!(sign(other_method, "SUBMIT", "50000").unwrap_err().contains("permissions beyond"));
    let transfer = SorobanAuthorizedInvocation {
        function: SorobanAuthorizedFunction::ContractFn(call(2, "transfer")),
        sub_invocations: vec![].try_into().unwrap(),
    };
    let nested = Shape { auth: vec![auth(1, "submit", Some(transfer))], ..Shape::default() };
    assert!(sign(nested, "SUBMIT", "50000").unwrap_err().contains("permissions beyond"));
}

#[test]
fn refuses_a_fee_that_differs_or_is_too_large_and_a_missing_or_long_expiry() {
    assert!(sign(Shape { fee: 60_000, ..Shape::default() }, "SUBMIT", "50000").unwrap_err().contains("fee does not match"));
    assert!(sign(Shape { fee: 200_000_000, ..Shape::default() }, "SUBMIT", "200000000").unwrap_err().contains("fee"));
    assert!(sign(Shape { max_time: 0, ..Shape::default() }, "SUBMIT", "50000").unwrap_err().contains("short expiry"));
    assert!(sign(Shape { max_time: NOW + 3_600, ..Shape::default() }, "SUBMIT", "50000").unwrap_err().contains("short expiry"));
}

#[test]
fn refuses_an_invalid_secret_or_envelope() {
    let me = public_key(&secret(7)).unwrap();
    assert!(sign_award_call(&envelope(Shape::default()), &preview(&me, "SUBMIT", "50000"), "not-a-key", NOW).is_err());
    assert!(sign_award_call("not-xdr", &preview(&me, "SUBMIT", "50000"), &secret(7), NOW).unwrap_err().contains("could not be read"));
}
