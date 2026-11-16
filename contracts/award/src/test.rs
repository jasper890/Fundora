#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    testutils::{
        storage::Instance as _, Address as _, AuthorizedFunction, Events as _, Ledger as _,
        MockAuth, MockAuthInvoke, MuxedAddress as _,
    },
    Address, BytesN, Env, IntoVal, MuxedAddress, Val, Vec,
};

#[contracttype]
#[derive(Clone)]
enum TokenKey {
    Balance(Address),
    FailTransfers,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
enum TokenError {
    TransferFailed = 1,
    InsufficientBalance = 2,
}

#[contract]
struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = TokenKey::Balance(to);
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(balance + amount));
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&TokenKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn set_fail_transfers(env: Env, fail: bool) {
        env.storage()
            .instance()
            .set(&TokenKey::FailTransfers, &fail);
    }

    pub fn transfer(env: Env, from: Address, to: MuxedAddress, amount: i128) {
        from.require_auth();
        if env
            .storage()
            .instance()
            .get::<_, bool>(&TokenKey::FailTransfers)
            .unwrap_or(false)
        {
            soroban_sdk::panic_with_error!(&env, TokenError::TransferFailed);
        }
        let from_key = TokenKey::Balance(from);
        let to_key = TokenKey::Balance(to.address());
        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        if amount <= 0 || from_balance < amount {
            soroban_sdk::panic_with_error!(&env, TokenError::InsufficientBalance);
        }
        env.storage()
            .persistent()
            .set(&from_key, &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&to_key, &(to_balance + amount));
    }
}

struct Fixture {
    env: Env,
    contract: Address,
    sponsor: Address,
    verifier: Address,
    recipient: Address,
    replacement_verifier: Address,
    token: Address,
    other_token: Address,
    award_id: BytesN<32>,
    policy_hash: BytesN<32>,
}

impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let sponsor = account(&env);
        let verifier = account(&env);
        let recipient = account(&env);
        let replacement_verifier = account(&env);
        let token = env.register(MockToken, ());
        let other_token = env.register(MockToken, ());
        let award_id = BytesN::from_array(&env, &[1; 32]);
        let policy_hash = BytesN::from_array(&env, &[2; 32]);
        let args = (
            sponsor.clone(),
            verifier.clone(),
            recipient.clone(),
            token.clone(),
            AWARD_AMOUNT,
            award_id.clone(),
            policy_hash.clone(),
            1_100u64,
            1_200u64,
            1_300u64,
        );
        let contract = Address::generate(&env);
        env.mock_all_auths();
        env.register_at(&contract, AwardContract, args);
        MockTokenClient::new(&env, &token).mint(&sponsor, &AWARD_AMOUNT);

        Self {
            env,
            contract,
            sponsor,
            verifier,
            recipient,
            replacement_verifier,
            token,
            other_token,
            award_id,
            policy_hash,
        }
    }

    fn client(&self) -> AwardContractClient<'_> {
        AwardContractClient::new(&self.env, &self.contract)
    }

    fn mock_all_auths(&self) {
        self.env.mock_all_auths();
    }

    fn fund(&self, expected_version: u64) {
        self.mock_all_auths();
        self.client().fund(&expected_version);
    }

    fn submit(&self, revision: u32, digest: &BytesN<32>, expected_version: u64) {
        self.mock_all_auths();
        self.client().submit(&revision, digest, &expected_version);
    }

    fn approve(&self, expected_version: u64) {
        self.mock_all_auths();
        self.client().approve(&expected_version);
    }

    fn reject(&self, expected_version: u64) {
        self.mock_all_auths();
        self.client().reject(&expected_version);
    }

    fn reopen(&self, expected_version: u64) {
        self.mock_all_auths();
        self.client().reopen(&expected_version);
    }

    fn set_hold(&self, actor: &Address, held: bool, expected_version: u64) {
        self.mock_all_auths();
        self.client().set_hold(actor, &held, &expected_version);
    }

    fn replace_verifier(&self, verifier: &Address, expected_version: u64) {
        self.mock_all_auths();
        self.client().replace_verifier(verifier, &expected_version);
    }

    fn pay(&self, expected_version: u64) {
        self.mock_all_auths();
        self.client().pay(&expected_version);
    }

    fn refund(&self, expected_version: u64) {
        self.mock_all_auths();
        self.client().refund(&expected_version);
    }

    fn specific_wrong_signer(&self, function: &str, args: Vec<Val>) {
        let wrong_signer = Address::generate(&self.env);
        let invoke = MockAuthInvoke {
            contract: &self.contract,
            fn_name: function,
            args,
            sub_invokes: &[],
        };
        self.env.mock_auths(&[MockAuth {
            address: &wrong_signer,
            invoke: &invoke,
        }]);
    }
}

fn account(env: &Env) -> Address {
    MuxedAddress::generate(env).address()
}

#[allow(clippy::too_many_arguments)]
fn register_award(
    env: &Env,
    sponsor: Address,
    verifier: Address,
    recipient: Address,
    token: Address,
    amount: i128,
    award_id: BytesN<32>,
    policy_hash: BytesN<32>,
    claim_deadline: u64,
    review_deadline: u64,
    payout_deadline: u64,
) -> Address {
    let contract = Address::generate(env);
    let args = (
        sponsor,
        verifier,
        recipient,
        token,
        amount,
        award_id,
        policy_hash,
        claim_deadline,
        review_deadline,
        payout_deadline,
    );
    env.mock_all_auths();
    env.register_at(&contract, AwardContract, args)
}

#[test]
fn generated_test_address_is_a_classic_account() {
    let env = Env::default();
    let address = account(&env);

    assert_eq!(address.to_string().to_bytes().get(0), Some(b'G'));
}

#[test]
fn constructor_accepts_valid_immutable_terms() {
    let fixture = Fixture::new();
    let state = fixture.client().get_state();

    assert_eq!(state.sponsor, fixture.sponsor);
    assert_eq!(state.verifier, fixture.verifier);
    assert_eq!(state.recipient, fixture.recipient);
    assert_eq!(state.token, fixture.token);
    assert_eq!(state.amount, AWARD_AMOUNT);
    assert_eq!(state.award_id, fixture.award_id);
    assert_eq!(state.policy_hash, fixture.policy_hash);
    assert_eq!(state.status, Status::Created);
    assert_eq!(state.version, 0);
}

#[test]
fn constructor_rejects_equal_roles() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let sponsor = account(&env);
    let recipient = account(&env);
    let token = env.register(MockToken, ());
    let id = BytesN::from_array(&env, &[1; 32]);
    let policy = BytesN::from_array(&env, &[2; 32]);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        register_award(
            &env,
            sponsor.clone(),
            sponsor.clone(),
            recipient,
            token,
            AWARD_AMOUNT,
            id,
            policy,
            1_100,
            1_200,
            1_300,
        )
    }));

    assert!(result.is_err());
}

#[test]
fn constructor_rejects_nonpositive_or_incorrect_amount() {
    for amount in [0, -1, AWARD_AMOUNT - 1, AWARD_AMOUNT + 1] {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let sponsor = account(&env);
        let verifier = account(&env);
        let recipient = account(&env);
        let token = env.register(MockToken, ());
        let id = BytesN::from_array(&env, &[1; 32]);
        let policy = BytesN::from_array(&env, &[2; 32]);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            register_award(
                &env,
                sponsor.clone(),
                verifier,
                recipient,
                token,
                amount,
                id,
                policy,
                1_100,
                1_200,
                1_300,
            )
        }));
        assert!(result.is_err(), "accepted amount {amount}");
    }
}

#[test]
fn constructor_rejects_invalid_deadline_ordering() {
    for (claim, review, payout) in [
        (1_000, 1_200, 1_300),
        (1_200, 1_200, 1_300),
        (1_100, 1_300, 1_200),
        (1_100, 1_200, 1_200),
    ] {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let sponsor = account(&env);
        let verifier = account(&env);
        let recipient = account(&env);
        let token = env.register(MockToken, ());
        let id = BytesN::from_array(&env, &[1; 32]);
        let policy = BytesN::from_array(&env, &[2; 32]);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            register_award(
                &env,
                sponsor.clone(),
                verifier,
                recipient,
                token,
                AWARD_AMOUNT,
                id,
                policy,
                claim,
                review,
                payout,
            )
        }));
        assert!(
            result.is_err(),
            "accepted deadlines {claim}, {review}, {payout}"
        );
    }
}

#[test]
fn constructor_rejects_zero_commitments() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let sponsor = account(&env);
    let verifier = account(&env);
    let recipient = account(&env);
    let token = env.register(MockToken, ());
    let zero = BytesN::from_array(&env, &[0; 32]);
    let policy = BytesN::from_array(&env, &[2; 32]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        register_award(
            &env,
            sponsor.clone(),
            verifier.clone(),
            recipient.clone(),
            token.clone(),
            AWARD_AMOUNT,
            zero.clone(),
            policy.clone(),
            1_100,
            1_200,
            1_300,
        )
    }));
    assert!(result.is_err());

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        register_award(
            &env,
            sponsor.clone(),
            verifier,
            recipient,
            token,
            AWARD_AMOUNT,
            BytesN::from_array(&env, &[1; 32]),
            zero,
            1_100,
            1_200,
            1_300,
        )
    }));
    assert!(result.is_err());
}

#[test]
fn constructor_records_sponsor_authorization() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let sponsor = account(&env);
    let verifier = account(&env);
    let recipient = account(&env);
    let token = env.register(MockToken, ());
    let contract = register_award(
        &env,
        sponsor.clone(),
        verifier,
        recipient,
        token,
        AWARD_AMOUNT,
        BytesN::from_array(&env, &[1; 32]),
        BytesN::from_array(&env, &[2; 32]),
        1_100,
        1_200,
        1_300,
    );
    let auths = env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, sponsor);
    match &auths[0].1.function {
        AuthorizedFunction::Contract((address, function, _)) => {
            assert_eq!(address, &contract);
            assert_eq!(function, &soroban_sdk::Symbol::new(&env, "__constructor"));
        }
        _ => panic!("constructor auth must name the contract function"),
    }
}

#[test]
fn fund_moves_exact_amount_at_claim_deadline() {
    let fixture = Fixture::new();
    fixture.env.ledger().set_timestamp(1_100);
    fixture.fund(0);

    let auths = fixture.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, fixture.sponsor);
    match &auths[0].1.function {
        AuthorizedFunction::Contract((address, function, args)) => {
            assert_eq!(address, &fixture.contract);
            assert_eq!(function, &soroban_sdk::Symbol::new(&fixture.env, "fund"));
            assert_eq!(args, &(0u64,).into_val(&fixture.env));
        }
        _ => panic!("fund auth must name the award contract function"),
    }
    assert_eq!(auths[0].1.sub_invocations.len(), 1);
    match &auths[0].1.sub_invocations[0].function {
        AuthorizedFunction::Contract((address, function, args)) => {
            assert_eq!(address, &fixture.token);
            assert_eq!(
                function,
                &soroban_sdk::Symbol::new(&fixture.env, "transfer")
            );
            let transfer_args: Vec<Val> = (
                fixture.sponsor.clone(),
                MuxedAddress::from(fixture.contract.clone()),
                AWARD_AMOUNT,
            )
                .into_val(&fixture.env);
            assert_eq!(args, &transfer_args);
        }
        _ => panic!("fund auth must include the bound token transfer"),
    }

    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
        0
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        AWARD_AMOUNT
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.other_token).balance(&fixture.contract),
        0
    );
    assert_eq!(fixture.client().get_state().status, Status::Funded);
    assert_eq!(fixture.client().get_state().version, 1);
}

#[test]
fn second_funding_is_rejected_without_moving_balances() {
    let fixture = Fixture::new();
    fixture.fund(0);
    let before_sponsor =
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor);
    let before_contract =
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract);

    fixture.mock_all_auths();
    assert!(matches!(
        fixture.client().try_fund(&1),
        Err(Ok(Error::InvalidState))
    ));

    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
        before_sponsor
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        before_contract
    );
    assert_eq!(fixture.client().get_state().status, Status::Funded);
    assert_eq!(fixture.client().get_state().version, 1);
}

#[test]
fn submit_without_funding_is_rejected() {
    let fixture = Fixture::new();
    let digest = BytesN::from_array(&fixture.env, &[3; 32]);
    fixture.mock_all_auths();

    assert!(matches!(
        fixture.client().try_submit(&1, &digest, &0),
        Err(Ok(Error::InvalidState))
    ));
    assert_eq!(fixture.client().get_state().status, Status::Created);
    assert_eq!(fixture.client().get_state().evidence_revision, 0);
}

#[test]
fn unapproved_pay_is_rejected_without_moving_balances() {
    let fixture = Fixture::new();
    fixture.fund(0);
    let before_sponsor =
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor);
    let before_contract =
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract);
    fixture.mock_all_auths();

    assert!(matches!(
        fixture.client().try_pay(&1),
        Err(Ok(Error::InvalidState))
    ));

    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
        before_sponsor
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        before_contract
    );
    assert_eq!(fixture.client().get_state().status, Status::Funded);
}

#[test]
fn wrong_signer_cannot_fund() {
    let fixture = Fixture::new();
    fixture.specific_wrong_signer("fund", (0u64,).into_val(&fixture.env));
    let before = MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor);

    assert!(fixture.client().try_fund(&0).is_err());

    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
        before
    );
    assert_eq!(fixture.client().get_state().status, Status::Created);
}

#[test]
fn evidence_revision_invalidates_old_approval() {
    let fixture = Fixture::new();
    let first_digest = BytesN::from_array(&fixture.env, &[3; 32]);
    let second_digest = BytesN::from_array(&fixture.env, &[4; 32]);
    fixture.fund(0);
    fixture.submit(1, &first_digest, 1);
    fixture.approve(2);
    assert!(fixture.client().get_state().approved);

    fixture.reopen(3);
    fixture.submit(2, &second_digest, 4);
    let before = MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract);
    fixture.mock_all_auths();
    assert!(matches!(
        fixture.client().try_pay(&5),
        Err(Ok(Error::InvalidState))
    ));

    let state = fixture.client().get_state();
    assert_eq!(state.status, Status::Submitted);
    assert_eq!(state.evidence_revision, 2);
    assert_eq!(state.evidence_digest, Some(second_digest));
    assert!(!state.approved);
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        before
    );
}

#[test]
fn stale_signed_action_fails_after_rotation() {
    let fixture = Fixture::new();
    let digest = BytesN::from_array(&fixture.env, &[5; 32]);
    fixture.fund(0);
    fixture.submit(1, &digest, 1);
    fixture.approve(2);
    fixture.replace_verifier(&fixture.replacement_verifier, 3);
    let before = fixture.client().get_state();

    fixture.mock_all_auths();
    assert!(matches!(
        fixture.client().try_approve(&3),
        Err(Ok(Error::StaleVersion))
    ));

    let after = fixture.client().get_state();
    assert_eq!(after, before);
    assert_eq!(after.verifier, fixture.replacement_verifier);
    assert!(!after.approved);
}

#[test]
fn holds_block_payout_but_not_expiry_refund() {
    let fixture = Fixture::new();
    let digest = BytesN::from_array(&fixture.env, &[6; 32]);
    fixture.fund(0);
    fixture.submit(1, &digest, 1);
    fixture.approve(2);
    fixture.set_hold(&fixture.sponsor, true, 3);
    fixture.set_hold(&fixture.verifier, true, 4);
    let before = MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract);

    fixture.mock_all_auths();
    assert!(matches!(fixture.client().try_pay(&5), Err(Ok(Error::Held))));
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        before
    );

    fixture.env.ledger().set_timestamp(1_301);
    fixture.refund(5);
    let state = fixture.client().get_state();
    assert_eq!(state.status, Status::Refunded);
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
        AWARD_AMOUNT
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        0
    );
}

#[test]
fn failed_transfer_rolls_back_paid_state() {
    let fixture = Fixture::new();
    let digest = BytesN::from_array(&fixture.env, &[7; 32]);
    fixture.fund(0);
    fixture.submit(1, &digest, 1);
    fixture.approve(2);
    let before = fixture.client().get_state();
    let contract_balance =
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract);
    let recipient_balance =
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.recipient);
    MockTokenClient::new(&fixture.env, &fixture.token).set_fail_transfers(&true);
    fixture.mock_all_auths();

    assert!(matches!(
        fixture.client().try_pay(&3),
        Err(Ok(Error::TransferFailed))
    ));

    assert_eq!(fixture.client().get_state(), before);
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        contract_balance
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.recipient),
        recipient_balance
    );
}

#[test]
fn rejected_appeal_reopens_before_review_cutoff() {
    let fixture = Fixture::new();
    let digest = BytesN::from_array(&fixture.env, &[8; 32]);
    fixture.fund(0);
    fixture.submit(1, &digest, 1);
    fixture.reject(2);
    assert_eq!(fixture.client().get_state().status, Status::Rejected);
    fixture.env.ledger().set_timestamp(1_200);

    fixture.reopen(3);

    let state = fixture.client().get_state();
    assert_eq!(state.status, Status::Submitted);
    assert!(!state.approved);
    assert_eq!(state.version, 4);
}

#[test]
fn archival_is_not_reinitialization() {
    let fixture = Fixture::new();
    let before_sponsor =
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor);
    let before_contract =
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract);
    fixture.env.as_contract(&fixture.contract, || {
        fixture.env.storage().instance().remove(&DataKey::State);
    });

    fixture.mock_all_auths();
    assert!(matches!(
        fixture.client().try_fund(&0),
        Err(Ok(Error::NotInitialized))
    ));
    assert!(matches!(
        fixture.client().try_get_state(),
        Err(Ok(Error::NotInitialized))
    ));
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
        before_sponsor
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        before_contract
    );
}

#[test]
fn lifetime_extension_preserves_award_state() {
    let fixture = Fixture::new();
    let initial = fixture.env.as_contract(&fixture.contract, || {
        fixture.env.storage().instance().get_ttl()
    });
    assert!(initial >= 1_000_000);

    fixture.env.ledger().set_sequence_number(900_000);
    fixture.client().extend_lifetime();

    let extended = fixture.env.as_contract(&fixture.contract, || {
        fixture.env.storage().instance().get_ttl()
    });
    assert!(extended >= 1_000_000);
    let state = fixture.client().get_state();
    assert_eq!(state.status, Status::Created);
    assert_eq!(state.version, 0);
}

#[test]
fn lifecycle_mutations_emit_public_history_events() {
    let fixture = Fixture::new();
    let digest = BytesN::from_array(&fixture.env, &[20; 32]);
    fixture.fund(0);
    assert_one_history_event(&fixture);
    fixture.submit(1, &digest, 1);
    assert_one_history_event(&fixture);
    fixture.approve(2);
    assert_one_history_event(&fixture);
    fixture.pay(3);
    assert_one_history_event(&fixture);
}

fn assert_one_history_event(fixture: &Fixture) {
    let events = fixture
        .env
        .events()
        .all()
        .filter_by_contract(&fixture.contract);
    assert_eq!(events.events().len(), 1);
}

#[test]
fn wrong_signer_is_rejected_for_every_mutating_action() {
    let created = Fixture::new();
    created.specific_wrong_signer("fund", (0u64,).into_val(&created.env));
    assert!(created.client().try_fund(&0).is_err());
    created.specific_wrong_signer("cancel", (0u64,).into_val(&created.env));
    assert!(created.client().try_cancel(&0).is_err());

    let funded = Fixture::new();
    funded.fund(0);
    funded.specific_wrong_signer(
        "submit",
        (1u32, BytesN::from_array(&funded.env, &[9; 32]), 1u64).into_val(&funded.env),
    );
    assert!(funded
        .client()
        .try_submit(&1, &BytesN::from_array(&funded.env, &[9; 32]), &1)
        .is_err());
    funded.specific_wrong_signer(
        "set_hold",
        (funded.sponsor.clone(), true, 1u64).into_val(&funded.env),
    );
    assert!(funded
        .client()
        .try_set_hold(&funded.sponsor, &true, &1)
        .is_err());
    funded.specific_wrong_signer(
        "replace_verifier",
        (funded.replacement_verifier.clone(), 1u64).into_val(&funded.env),
    );
    assert!(funded
        .client()
        .try_replace_verifier(&funded.replacement_verifier, &1)
        .is_err());

    let submitted = Fixture::new();
    let digest = BytesN::from_array(&submitted.env, &[10; 32]);
    submitted.fund(0);
    submitted.submit(1, &digest, 1);
    submitted.specific_wrong_signer("approve", (2u64,).into_val(&submitted.env));
    assert!(submitted.client().try_approve(&2).is_err());
    submitted.specific_wrong_signer("reject", (2u64,).into_val(&submitted.env));
    assert!(submitted.client().try_reject(&2).is_err());
    submitted.reject(2);
    submitted.specific_wrong_signer("reopen", (3u64,).into_val(&submitted.env));
    assert!(submitted.client().try_reopen(&3).is_err());

    let approved = Fixture::new();
    let digest = BytesN::from_array(&approved.env, &[11; 32]);
    approved.fund(0);
    approved.submit(1, &digest, 1);
    approved.approve(2);
    approved.specific_wrong_signer("pay", (3u64,).into_val(&approved.env));
    assert!(approved.client().try_pay(&3).is_err());

    let expired = Fixture::new();
    expired.fund(0);
    expired.env.ledger().set_timestamp(1_301);
    expired.specific_wrong_signer("refund", (1u64,).into_val(&expired.env));
    assert!(expired.client().try_refund(&1).is_err());
}

#[test]
fn deadline_boundaries_are_inclusive_for_fund_approval_and_pay() {
    let fixture = Fixture::new();
    let digest = BytesN::from_array(&fixture.env, &[12; 32]);
    fixture.env.ledger().set_timestamp(1_100);
    fixture.fund(0);
    fixture.submit(1, &digest, 1);
    fixture.env.ledger().set_timestamp(1_200);
    fixture.approve(2);
    fixture.env.ledger().set_timestamp(1_300);
    fixture.pay(3);

    let state = fixture.client().get_state();
    assert_eq!(state.status, Status::Paid);
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.recipient),
        AWARD_AMOUNT
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        0
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.other_token).balance(&fixture.recipient),
        0
    );
}

#[test]
fn late_funding_and_refund_at_cutoff_fail_without_transfers() {
    let late_fund = Fixture::new();
    late_fund.env.ledger().set_timestamp(1_101);
    late_fund.mock_all_auths();
    assert!(matches!(
        late_fund.client().try_fund(&0),
        Err(Ok(Error::Deadline))
    ));
    assert_eq!(
        MockTokenClient::new(&late_fund.env, &late_fund.token).balance(&late_fund.sponsor),
        AWARD_AMOUNT
    );
    assert_eq!(
        MockTokenClient::new(&late_fund.env, &late_fund.token).balance(&late_fund.contract),
        0
    );

    let cutoff_refund = Fixture::new();
    cutoff_refund.fund(0);
    cutoff_refund.env.ledger().set_timestamp(1_300);
    cutoff_refund.mock_all_auths();
    assert!(matches!(
        cutoff_refund.client().try_refund(&1),
        Err(Ok(Error::Deadline))
    ));
    assert_eq!(
        MockTokenClient::new(&cutoff_refund.env, &cutoff_refund.token)
            .balance(&cutoff_refund.sponsor),
        0
    );
    assert_eq!(
        MockTokenClient::new(&cutoff_refund.env, &cutoff_refund.token)
            .balance(&cutoff_refund.contract),
        AWARD_AMOUNT
    );
}

#[test]
fn payout_and_refund_are_terminal_and_cannot_repeat() {
    let paid = Fixture::new();
    let digest = BytesN::from_array(&paid.env, &[13; 32]);
    paid.fund(0);
    paid.submit(1, &digest, 1);
    paid.approve(2);
    paid.pay(3);
    let paid_balances = (
        MockTokenClient::new(&paid.env, &paid.token).balance(&paid.sponsor),
        MockTokenClient::new(&paid.env, &paid.token).balance(&paid.recipient),
        MockTokenClient::new(&paid.env, &paid.token).balance(&paid.contract),
    );
    paid.mock_all_auths();
    assert!(matches!(
        paid.client().try_pay(&4),
        Err(Ok(Error::InvalidState))
    ));
    assert!(matches!(
        paid.client().try_refund(&4),
        Err(Ok(Error::InvalidState))
    ));
    assert_eq!(
        paid_balances,
        (
            MockTokenClient::new(&paid.env, &paid.token).balance(&paid.sponsor),
            MockTokenClient::new(&paid.env, &paid.token).balance(&paid.recipient),
            MockTokenClient::new(&paid.env, &paid.token).balance(&paid.contract),
        )
    );

    let refunded = Fixture::new();
    refunded.fund(0);
    refunded.env.ledger().set_timestamp(1_301);
    refunded.refund(1);
    let refund_balances = (
        MockTokenClient::new(&refunded.env, &refunded.token).balance(&refunded.sponsor),
        MockTokenClient::new(&refunded.env, &refunded.token).balance(&refunded.contract),
    );
    refunded.mock_all_auths();
    assert!(matches!(
        refunded.client().try_refund(&2),
        Err(Ok(Error::InvalidState))
    ));
    assert!(matches!(
        refunded.client().try_pay(&2),
        Err(Ok(Error::InvalidState))
    ));
    assert_eq!(
        refund_balances,
        (
            MockTokenClient::new(&refunded.env, &refunded.token).balance(&refunded.sponsor),
            MockTokenClient::new(&refunded.env, &refunded.token).balance(&refunded.contract),
        )
    );
}

#[test]
fn cancellation_is_sponsor_only_and_never_moves_funds() {
    let fixture = Fixture::new();
    let before = MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor);
    fixture.mock_all_auths();
    fixture.client().cancel(&0);

    assert_eq!(fixture.client().get_state().status, Status::Cancelled);
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
        before
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        0
    );
}

#[test]
fn approval_without_evidence_returns_missing_evidence() {
    let fixture = Fixture::new();
    fixture.fund(0);
    fixture.mock_all_auths();

    assert!(matches!(
        fixture.client().try_approve(&1),
        Err(Ok(Error::MissingEvidence))
    ));
    assert_eq!(fixture.client().get_state().status, Status::Funded);
    assert_eq!(fixture.client().get_state().version, 1);
}

#[test]
fn expiry_refund_covers_all_unpaid_states_and_hold_combinations() {
    for stage in 0..4 {
        for sponsor_hold in [false, true] {
            for verifier_hold in [false, true] {
                let fixture = Fixture::new();
                let digest = BytesN::from_array(&fixture.env, &[31; 32]);
                fixture.fund(0);
                let mut version = 1;
                if stage > 0 {
                    fixture.submit(1, &digest, version);
                    version += 1;
                }
                if stage == 2 {
                    fixture.approve(version);
                    version += 1;
                }
                if stage == 3 {
                    fixture.reject(version);
                    version += 1;
                }
                if sponsor_hold {
                    fixture.set_hold(&fixture.sponsor, true, version);
                    version += 1;
                }
                if verifier_hold {
                    fixture.set_hold(&fixture.verifier, true, version);
                    version += 1;
                }
                fixture.env.ledger().set_timestamp(1_300);
                fixture.mock_all_auths();
                assert!(matches!(
                    fixture.client().try_refund(&version),
                    Err(Ok(Error::Deadline))
                ));
                assert_eq!(
                    MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
                    AWARD_AMOUNT
                );
                assert_eq!(
                    MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
                    0
                );
                fixture.env.ledger().set_timestamp(1_301);
                fixture.refund(version);
                let auths = fixture.env.auths();
                assert_eq!(auths.len(), 1);
                assert_eq!(auths[0].0, fixture.sponsor);
                assert_eq!(fixture.client().get_state().status, Status::Refunded);
                assert_eq!(fixture.client().get_state().version, version + 1);
                assert_eq!(
                    MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.sponsor),
                    AWARD_AMOUNT
                );
                assert_eq!(
                    MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
                    0
                );
                assert_eq!(
                    MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.recipient),
                    0
                );
            }
        }
    }
}

#[test]
fn late_payment_preserves_approval_and_fixed_balances() {
    let fixture = Fixture::new();
    let digest = BytesN::from_array(&fixture.env, &[32; 32]);
    fixture.fund(0);
    fixture.submit(1, &digest, 1);
    fixture.approve(2);
    let before = fixture.client().get_state();
    fixture.env.ledger().set_timestamp(1_301);
    fixture.mock_all_auths();
    assert!(matches!(
        fixture.client().try_pay(&3),
        Err(Ok(Error::Deadline))
    ));
    assert_eq!(fixture.client().get_state(), before);
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.contract),
        AWARD_AMOUNT
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.token).balance(&fixture.recipient),
        0
    );
    assert_eq!(
        MockTokenClient::new(&fixture.env, &fixture.other_token).balance(&fixture.recipient),
        0
    );
}
