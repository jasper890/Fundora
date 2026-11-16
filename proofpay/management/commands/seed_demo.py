import json
import os
import re
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from stellar_sdk import Keypair, StrKey

from proofpay.models import Program, ProgramMember, create_award


class Command(BaseCommand):
    help="Create an idempotent synthetic ten-recipient cohort; never fund or deploy."
    def add_arguments(self,parser):
        parser.add_argument("--prefix",default="demo")
        parser.add_argument("--preview",action="store_true")
        parser.add_argument("--wallet-map")
        parser.add_argument("--password-env")
        parser.add_argument("--expiry-test",action="store_true")
    @transaction.atomic
    def handle(self,*args,**options):
        prefix=options["prefix"]
        if not re.fullmatch(r"[a-z0-9-]{1,24}",prefix):
            raise CommandError("Prefix must be 1-24 lowercase letters, digits or hyphens.")
        title=f"Synthetic ProofPay workshop ({prefix})"
        if options["expiry_test"]:
            title+=" - short expiry test"
        existing=Program.objects.filter(title=title).first()
        if existing:
            if existing.awards.count()!=10:
                raise CommandError("Existing cohort is incomplete; investigate without overwriting records.")
            self.stdout.write(f"Existing synthetic program: {existing.pk}")
            return
        if bool(options["preview"])==bool(options["wallet_map"]):
            raise CommandError("Choose --preview or --wallet-map containing only public addresses.")
        if options["wallet_map"]:
            try:
                with open(options["wallet_map"],encoding="utf-8") as handle:
                    mapping=json.load(handle)
                if set(mapping)!={"sponsor","verifier","recipients"} or not isinstance(mapping["recipients"],list) or len(mapping["recipients"])!=10:
                    raise ValueError
                wallets=[mapping["sponsor"],mapping["verifier"],*mapping["recipients"]]
                if len(set(wallets))!=12 or not all(isinstance(address,str) and StrKey.is_valid_ed25519_public_key(address) for address in wallets):
                    raise ValueError
            except (OSError,ValueError,TypeError):
                raise CommandError("Wallet map must contain twelve distinct valid public G-addresses and no secrets.") from None
        else:
            wallets=[Keypair.random().public_key for _ in range(12)]
        password=None
        if options["password_env"]:
            password=os.environ.get(options["password_env"])
            if not password or len(password)<12:
                raise CommandError("The password environment variable must contain at least 12 characters.")
        usernames=[f"{prefix}-sponsor",f"{prefix}-verifier",*[f"{prefix}-recipient-{n:02}" for n in range(1,11)]]
        if get_user_model().objects.filter(username__in=usernames).exists():
            raise CommandError("A requested demo username already exists; choose a new prefix.")
        users=[get_user_model().objects.create_user(name,password=password) for name in usernames]
        now=timezone.now()
        windows=[timedelta(minutes=n) for n in (5,10,15)] if options["expiry_test"] else [timedelta(days=n) for n in (7,9,10)]
        program=Program.objects.create(title=title,requirements_text="Complete the synthetic workshop and have its organizer record independently checked. Synthetic Testnet demo only; no real monetary value.",sponsor_user=users[0],verifier_user=users[1],claim_deadline=now+windows[0],review_deadline=now+windows[1],payout_deadline=now+windows[2])
        roles=["SPONSOR","VERIFIER"]+["RECIPIENT"]*10
        members=[ProgramMember.objects.create(program=program,user=user,role=role,public_wallet=wallet) for user,role,wallet in zip(users,roles,wallets)]
        for recipient in members[2:]:
            create_award(program,sponsor=members[0],verifier=members[1],recipient=recipient)
        label="Preview only: generated addresses have no retained signing keys." if options["preview"] else "Public-address map loaded; no funding or deployment performed."
        self.stdout.write(f"Synthetic program: {program.pk}. Ten awards created. {label}")
