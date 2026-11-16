#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short,
    token::TokenClient, Address, BytesN, Env, MuxedAddress, Symbol,
};

pub const AWARD_AMOUNT: i128 = 200_000_000;

const INSTANCE_TTL_THRESHOLD: u32 = 120_960;
const INSTANCE_TTL_EXTEND_TO: u32 = 1_000_000;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    Created,
    Funded,
    Submitted,
    Approved,
    Rejected,
    Paid,
    Refunded,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AwardState {
    pub sponsor: Address,
    pub verifier: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub award_id: BytesN<32>,
    pub policy_hash: BytesN<32>,
    pub claim_deadline: u64,
    pub review_deadline: u64,
    pub payout_deadline: u64,
    pub status: Status,
    pub version: u64,
    pub evidence_revision: u32,
    pub evidence_digest: Option<BytesN<32>>,
    pub approved: bool,
    pub sponsor_hold: bool,
    pub verifier_hold: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    State,
    Approval,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct Approval {
    verifier: Address,
    revision: u32,
    digest: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
struct HistoryEvent {
    #[topic]
    action: Symbol,
    actor: Option<Address>,
    other: Option<Address>,
    amount: Option<i128>,
    revision: Option<u32>,
    digest: Option<BytesN<32>>,
    held: Option<bool>,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    BadTerms = 1,
    UnauthorizedRole = 2,
    InvalidState = 3,
    StaleVersion = 4,
    Deadline = 5,
    Held = 6,
    MissingEvidence = 7,
    TransferFailed = 8,
    InvalidEvidence = 9,
    NotInitialized = 10,
    Overflow = 11,
}

#[contract]
pub struct AwardContract;

#[contractimpl]
impl AwardContract {
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
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
    ) {
        let zero = BytesN::from_array(&env, &[0; 32]);
        if !is_classic_account(&sponsor)
            || !is_classic_account(&verifier)
            || !is_classic_account(&recipient)
            || sponsor == verifier
            || sponsor == recipient
            || verifier == recipient
            || amount != AWARD_AMOUNT
            || award_id == zero
            || policy_hash == zero
            || env.ledger().timestamp() >= claim_deadline
            || claim_deadline >= review_deadline
            || review_deadline >= payout_deadline
        {
            soroban_sdk::panic_with_error!(&env, Error::BadTerms);
        }

        sponsor.require_auth();
        save_state(
            &env,
            &AwardState {
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
                status: Status::Created,
                version: 0,
                evidence_revision: 0,
                evidence_digest: None,
                approved: false,
                sponsor_hold: false,
                verifier_hold: false,
            },
        );
    }

    pub fn get_state(env: Env) -> Result<AwardState, Error> {
        load_state(&env)
    }

    pub fn fund(env: Env, expected_version: u64) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.sponsor.require_auth();
        if state.status != Status::Created {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() > state.claim_deadline {
            return Err(Error::Deadline);
        }

        state.status = Status::Funded;
        advance_version(&mut state)?;
        save_state(&env, &state);
        transfer(
            &env,
            &state.token,
            &state.sponsor,
            &env.current_contract_address(),
            state.amount,
        )?;
        HistoryEvent {
            action: symbol_short!("fund"),
            actor: Some(state.sponsor),
            other: Some(env.current_contract_address()),
            amount: Some(state.amount),
            revision: None,
            digest: None,
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn cancel(env: Env, expected_version: u64) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.sponsor.require_auth();
        if state.status != Status::Created {
            return Err(Error::InvalidState);
        }

        state.status = Status::Cancelled;
        advance_version(&mut state)?;
        save_state(&env, &state);
        HistoryEvent {
            action: symbol_short!("cancel"),
            actor: Some(state.sponsor),
            other: None,
            amount: None,
            revision: None,
            digest: None,
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn submit(
        env: Env,
        revision: u32,
        digest: BytesN<32>,
        expected_version: u64,
    ) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.recipient.require_auth();
        if !matches!(state.status, Status::Funded | Status::Submitted) {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() > state.claim_deadline {
            return Err(Error::Deadline);
        }
        let next_revision = state
            .evidence_revision
            .checked_add(1)
            .ok_or(Error::Overflow)?;
        if revision != next_revision || digest == BytesN::from_array(&env, &[0; 32]) {
            return Err(Error::InvalidEvidence);
        }

        state.status = Status::Submitted;
        state.evidence_revision = revision;
        state.evidence_digest = Some(digest.clone());
        state.approved = false;
        advance_version(&mut state)?;
        env.storage().instance().remove(&DataKey::Approval);
        save_state(&env, &state);
        HistoryEvent {
            action: symbol_short!("evidence"),
            actor: Some(state.recipient),
            other: None,
            amount: None,
            revision: Some(revision),
            digest: Some(digest),
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn approve(env: Env, expected_version: u64) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.verifier.require_auth();
        let digest = state
            .evidence_digest
            .clone()
            .ok_or(Error::MissingEvidence)?;
        if state.evidence_revision == 0 || digest == BytesN::from_array(&env, &[0; 32]) {
            return Err(Error::MissingEvidence);
        }
        if state.status != Status::Submitted {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() > state.review_deadline {
            return Err(Error::Deadline);
        }
        if state.sponsor_hold || state.verifier_hold {
            return Err(Error::Held);
        }
        state.status = Status::Approved;
        state.approved = true;
        advance_version(&mut state)?;
        env.storage().instance().set(
            &DataKey::Approval,
            &Approval {
                verifier: state.verifier.clone(),
                revision: state.evidence_revision,
                digest: digest.clone(),
            },
        );
        save_state(&env, &state);
        HistoryEvent {
            action: symbol_short!("approved"),
            actor: Some(state.verifier),
            other: None,
            amount: None,
            revision: Some(state.evidence_revision),
            digest: Some(digest),
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn reject(env: Env, expected_version: u64) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.verifier.require_auth();
        if !matches!(state.status, Status::Submitted | Status::Approved) {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() > state.review_deadline {
            return Err(Error::Deadline);
        }

        state.status = Status::Rejected;
        state.approved = false;
        advance_version(&mut state)?;
        env.storage().instance().remove(&DataKey::Approval);
        save_state(&env, &state);
        HistoryEvent {
            action: symbol_short!("rejected"),
            actor: Some(state.verifier),
            other: None,
            amount: None,
            revision: Some(state.evidence_revision),
            digest: state.evidence_digest,
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn reopen(env: Env, expected_version: u64) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.verifier.require_auth();
        if !matches!(state.status, Status::Rejected | Status::Approved) {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() > state.review_deadline {
            return Err(Error::Deadline);
        }

        state.status = Status::Submitted;
        state.approved = false;
        advance_version(&mut state)?;
        env.storage().instance().remove(&DataKey::Approval);
        save_state(&env, &state);
        HistoryEvent {
            action: symbol_short!("reopened"),
            actor: Some(state.verifier),
            other: None,
            amount: None,
            revision: Some(state.evidence_revision),
            digest: state.evidence_digest,
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn set_hold(
        env: Env,
        actor: Address,
        held: bool,
        expected_version: u64,
    ) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        let sponsor = actor == state.sponsor;
        let verifier = actor == state.verifier;
        if !sponsor && !verifier {
            return Err(Error::UnauthorizedRole);
        }
        actor.require_auth();
        if !matches!(
            state.status,
            Status::Funded | Status::Submitted | Status::Approved | Status::Rejected
        ) {
            return Err(Error::InvalidState);
        }

        if sponsor {
            state.sponsor_hold = held;
        } else {
            state.verifier_hold = held;
        }
        advance_version(&mut state)?;
        save_state(&env, &state);
        HistoryEvent {
            action: symbol_short!("hold"),
            actor: Some(actor),
            other: None,
            amount: None,
            revision: None,
            digest: None,
            held: Some(held),
        }
        .publish(&env);
        Ok(())
    }

    pub fn replace_verifier(
        env: Env,
        new_verifier: Address,
        expected_version: u64,
    ) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.sponsor.require_auth();
        if matches!(
            state.status,
            Status::Paid | Status::Refunded | Status::Cancelled
        ) {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() > state.review_deadline {
            return Err(Error::Deadline);
        }
        if !is_classic_account(&new_verifier)
            || new_verifier == state.sponsor
            || new_verifier == state.recipient
            || new_verifier == state.verifier
        {
            return Err(Error::BadTerms);
        }

        let old_verifier = state.verifier.clone();
        state.verifier = new_verifier.clone();
        state.verifier_hold = false;
        state.approved = false;
        if matches!(state.status, Status::Approved | Status::Rejected) {
            state.status = Status::Submitted;
        }
        advance_version(&mut state)?;
        env.storage().instance().remove(&DataKey::Approval);
        save_state(&env, &state);
        HistoryEvent {
            action: symbol_short!("verifier"),
            actor: Some(old_verifier),
            other: Some(new_verifier),
            amount: None,
            revision: None,
            digest: None,
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn pay(env: Env, expected_version: u64) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.sponsor.require_auth();
        if state.status != Status::Approved {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() > state.payout_deadline {
            return Err(Error::Deadline);
        }
        if state.sponsor_hold || state.verifier_hold {
            return Err(Error::Held);
        }
        let approval: Approval = env
            .storage()
            .instance()
            .get(&DataKey::Approval)
            .ok_or(Error::MissingEvidence)?;
        if !state.approved
            || approval.verifier != state.verifier
            || approval.revision != state.evidence_revision
            || state.evidence_digest.as_ref() != Some(&approval.digest)
        {
            return Err(Error::MissingEvidence);
        }

        state.status = Status::Paid;
        advance_version(&mut state)?;
        save_state(&env, &state);
        transfer(
            &env,
            &state.token,
            &env.current_contract_address(),
            &state.recipient,
            state.amount,
        )?;
        HistoryEvent {
            action: symbol_short!("paid"),
            actor: Some(state.sponsor),
            other: Some(state.recipient),
            amount: Some(state.amount),
            revision: None,
            digest: None,
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn refund(env: Env, expected_version: u64) -> Result<(), Error> {
        let mut state = load_state(&env)?;
        check_version(&state, expected_version)?;
        state.sponsor.require_auth();
        if !matches!(
            state.status,
            Status::Funded | Status::Submitted | Status::Approved | Status::Rejected
        ) {
            return Err(Error::InvalidState);
        }
        if env.ledger().timestamp() <= state.payout_deadline {
            return Err(Error::Deadline);
        }

        state.status = Status::Refunded;
        state.approved = false;
        advance_version(&mut state)?;
        env.storage().instance().remove(&DataKey::Approval);
        save_state(&env, &state);
        transfer(
            &env,
            &state.token,
            &env.current_contract_address(),
            &state.sponsor,
            state.amount,
        )?;
        HistoryEvent {
            action: symbol_short!("refund"),
            actor: Some(env.current_contract_address()),
            other: Some(state.sponsor),
            amount: Some(state.amount),
            revision: None,
            digest: None,
            held: None,
        }
        .publish(&env);
        Ok(())
    }

    pub fn extend_lifetime(env: Env) -> Result<(), Error> {
        load_state(&env)?;
        extend_instance_ttl(&env);
        Ok(())
    }
}

fn is_classic_account(address: &Address) -> bool {
    address.to_string().to_bytes().get(0) == Some(b'G')
}

fn load_state(env: &Env) -> Result<AwardState, Error> {
    env.storage()
        .instance()
        .get(&DataKey::State)
        .ok_or(Error::NotInitialized)
}

fn save_state(env: &Env, state: &AwardState) {
    env.storage().instance().set(&DataKey::State, state);
    extend_instance_ttl(env);
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn check_version(state: &AwardState, expected_version: u64) -> Result<(), Error> {
    if state.version != expected_version {
        return Err(Error::StaleVersion);
    }
    Ok(())
}

fn advance_version(state: &mut AwardState) -> Result<(), Error> {
    state.version = state.version.checked_add(1).ok_or(Error::Overflow)?;
    Ok(())
}

fn transfer(
    env: &Env,
    token: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), Error> {
    match TokenClient::new(env, token).try_transfer(from, MuxedAddress::from(to.clone()), &amount) {
        Ok(Ok(())) => Ok(()),
        _ => Err(Error::TransferFailed),
    }
}

#[cfg(test)]
mod test;
