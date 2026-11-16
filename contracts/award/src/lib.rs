#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env};

pub const AWARD_AMOUNT: i128 = 200_000_000;

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
        env.storage().instance().set(
            &DataKey::State,
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
        env.storage()
            .instance()
            .get(&DataKey::State)
            .ok_or(Error::NotInitialized)
    }

    pub fn fund(_env: Env, _expected_version: u64) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn cancel(_env: Env, _expected_version: u64) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn submit(
        _env: Env,
        _revision: u32,
        _digest: BytesN<32>,
        _expected_version: u64,
    ) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn approve(_env: Env, _expected_version: u64) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn reject(_env: Env, _expected_version: u64) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn reopen(_env: Env, _expected_version: u64) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn set_hold(
        _env: Env,
        _actor: Address,
        _held: bool,
        _expected_version: u64,
    ) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn replace_verifier(
        _env: Env,
        _new_verifier: Address,
        _expected_version: u64,
    ) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn pay(_env: Env, _expected_version: u64) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn refund(_env: Env, _expected_version: u64) -> Result<(), Error> {
        Err(Error::InvalidState)
    }

    pub fn extend_lifetime(_env: Env) -> Result<(), Error> {
        Err(Error::InvalidState)
    }
}

fn is_classic_account(address: &Address) -> bool {
    address.to_string().to_bytes().get(0) == Some(b'G')
}

#[cfg(test)]
mod test;
