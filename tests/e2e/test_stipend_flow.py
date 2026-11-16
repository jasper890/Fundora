import asyncio
import json
import tempfile
from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, override_settings
from django.utils import timezone
from playwright.async_api import async_playwright
from stellar_sdk import Keypair

from proofpay.evidence import store_evidence
from proofpay.models import Award, ChainOperation, Program, ProgramMember, create_award


User = get_user_model()


class StipendFlowBrowserTests(StaticLiveServerTestCase):
    def setUp(self):
        super().setUp()
        self.evidence_root = tempfile.TemporaryDirectory(prefix="proofpay-e2e-")
        self.addCleanup(self.evidence_root.cleanup)
        settings_override = override_settings(
            PRIVATE_EVIDENCE_ROOT=self.evidence_root.name
        )
        settings_override.enable()
        self.addCleanup(settings_override.disable)

        self.sponsor = User.objects.create_user("synthetic-sponsor")
        self.verifier = User.objects.create_user("synthetic-verifier")
        self.recipient = User.objects.create_user("synthetic-recipient")
        self.program = Program.objects.create(
            title="Synthetic workshop",
            requirements_text="Complete the synthetic workshop.",
            requirements_version=1,
            sponsor_user=self.sponsor,
            verifier_user=self.verifier,
            claim_deadline=timezone.now() + timedelta(days=7),
            review_deadline=timezone.now() + timedelta(days=9),
            payout_deadline=timezone.now() + timedelta(days=10),
        )
        self.sponsor_member = self.member(self.sponsor, ProgramMember.Role.SPONSOR)
        self.verifier_member = self.member(self.verifier, ProgramMember.Role.VERIFIER)
        self.recipient_member = self.member(self.recipient, ProgramMember.Role.RECIPIENT)
        self.award = create_award(
            self.program,
            sponsor=self.sponsor_member,
            verifier=self.verifier_member,
            recipient=self.recipient_member,
        )
        self.award.status = Award.Status.FUNDED
        self.award.save(update_fields=("status",))
        self.evidence = store_evidence(
            self.recipient,
            self.award,
            [SimpleUploadedFile("synthetic.pdf", b"%PDF-1.4 synthetic", "application/pdf")],
            "Synthetic workshop completion record.",
            "synthetic://workshop/record-1",
            expected_revision=0,
        )
        self.award.status = Award.Status.SUBMITTED
        self.award.save(update_fields=("status",))

    def member(self, user, role):
        return ProgramMember.objects.create(
            program=self.program,
            user=user,
            role=role,
            public_wallet=Keypair.random().public_key,
        )

    def session_cookie(self, user):
        client = Client()
        client.force_login(user)
        return client.cookies[settings.SESSION_COOKIE_NAME].value

    async def page_as(self, browser, session_cookie):
        context = await browser.new_context()
        await context.add_cookies(
            [
                {
                    "name": settings.SESSION_COOKIE_NAME,
                    "value": session_cookie,
                    "url": self.live_server_url,
                }
            ]
        )
        return context, await context.new_page()

    def run_browser_flow(self, flow):
        asyncio.run(self.with_browser(flow))

    async def with_browser(self, flow):
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()
            try:
                await flow(browser)
            finally:
                await browser.close()

    def award_url(self):
        return f"{self.live_server_url}/awards/{self.award.pk}/"

    def test_three_roles_see_their_assigned_workflow(self):
        cookies = {
            "recipient": self.session_cookie(self.recipient),
            "verifier": self.session_cookie(self.verifier),
            "sponsor": self.session_cookie(self.sponsor),
        }
        self.run_browser_flow(lambda browser: self.check_role_workflows(browser, cookies))

    async def check_role_workflows(self, browser, cookies):
        recipient_context, recipient_page = await self.page_as(
            browser, cookies["recipient"]
        )
        await recipient_page.goto(self.award_url())
        self.assertTrue(
            await recipient_page.get_by_role(
                "heading", name="Add a new evidence revision"
            ).is_visible()
        )
        self.assertTrue(
            await recipient_page.get_by_role("heading", name="Request a review").is_visible()
        )
        self.assertFalse(await recipient_page.get_by_label("Original source checked").count())
        await recipient_context.close()

        verifier_context, verifier_page = await self.page_as(
            browser, cookies["verifier"]
        )
        await verifier_page.goto(self.award_url())
        self.assertTrue(
            await verifier_page.get_by_role("heading", name="Review revision 1").is_visible()
        )
        self.assertTrue(
            await verifier_page.get_by_label("Original source checked").is_visible()
        )
        self.assertFalse(
            await verifier_page.get_by_role(
                "heading", name="Add a new evidence revision"
            ).count()
        )
        await verifier_context.close()

        sponsor_context, sponsor_page = await self.page_as(
            browser, cookies["sponsor"]
        )
        await sponsor_page.goto(self.award_url())
        self.assertTrue(
            await sponsor_page.get_by_role("heading", name="Wallet actions").is_visible()
        )
        self.assertTrue(
            await sponsor_page.get_by_label("Action to review")
            .locator("option", has_text="Review award deployment")
            .count()
        )
        self.assertIn(
            "Not confirmed on-chain",
            await sponsor_page.locator(".status").inner_text(),
        )
        await sponsor_context.close()

    def test_anonymous_and_unrelated_users_cannot_download_evidence(self):
        outsider = User.objects.create_user("unrelated-viewer")
        outsider_cookie = self.session_cookie(outsider)
        self.run_browser_flow(lambda browser: self.check_evidence_denial(browser, outsider_cookie))

    async def check_evidence_denial(self, browser, outsider_cookie):
        evidence_url = f"{self.live_server_url}/evidence/{self.evidence.pk}/download/"
        anonymous_page = await browser.new_page()
        anonymous_response = await anonymous_page.goto(evidence_url)
        self.assertEqual(anonymous_response.status, 200)
        self.assertIn("/login/", anonymous_page.url)
        await anonymous_page.close()

        outsider_context, outsider_page = await self.page_as(
            browser, outsider_cookie
        )
        response = await outsider_page.goto(evidence_url)
        self.assertEqual(response.status, 404)
        self.assertNotIn(
            "Synthetic workshop completion record.",
            await outsider_page.locator("body").inner_text(),
        )
        await outsider_context.close()

    def test_keyboard_can_preview_without_activating_wallet_signing(self):
        cookie = self.session_cookie(self.sponsor)
        self.run_browser_flow(lambda browser: self.check_keyboard_flow(browser, cookie))

    async def check_keyboard_flow(self, browser, cookie):
        context, page = await self.page_as(browser, cookie)
        responses = []
        page.on("response", lambda response: responses.append((response.url, response.status)))
        await page.goto(self.award_url())
        bundle_responses = [entry for entry in responses if entry[0].endswith("/wallet.js")]
        self.assertTrue(bundle_responses, f"No wallet bundle request was observed: {responses}")
        self.assertEqual(
            bundle_responses[-1][1], 200,
            f"Wallet bundle response: {bundle_responses[-1]}",
        )
        requests = []
        page.on("request", lambda request: requests.append(request.url))
        operation_id = str(uuid4())

        async def prepare(route):
            await route.fulfill(
                status=201,
                content_type="application/json",
                body=json.dumps(
                    {
                        "operation_id": operation_id,
                        "unsigned_xdr": "synthetic-unsigned-envelope",
                        "preview": {
                            "action": "DEPLOY",
                            "network": "Testnet",
                            "signer": self.sponsor_member.public_wallet,
                            "amount_base_units": "200000000",
                            "maximum_fee_base_units": "1000000",
                        },
                        "status": "PREPARED",
                    }
                ),
            )

        await page.route(f"**/awards/{self.award.pk}/prepare/deploy/", prepare)
        prepare_button = page.get_by_role("button", name="Prepare action preview")
        for _ in range(40):
            if await prepare_button.evaluate(
                "element => document.activeElement === element"
            ):
                break
            await page.keyboard.press("Tab")
        self.assertTrue(
            await prepare_button.evaluate(
                "element => document.activeElement === element"
            ),
            "Tab navigation reaches the preparation control",
        )

        await page.keyboard.press("Enter")
        sign_button = page.locator("[data-sign]")
        await sign_button.wait_for(state="visible")
        self.assertTrue(
            await sign_button.evaluate("element => document.activeElement === element")
        )
        await page.keyboard.press("Tab")
        cancel_button = page.locator("[data-cancel]")
        self.assertTrue(
            await cancel_button.evaluate("element => document.activeElement === element")
        )
        self.assertFalse(any("/submit/" in request for request in requests))
        await context.close()

    def test_unknown_operation_stays_unconfirmed_after_status_refresh(self):
        operation = ChainOperation.objects.create(
            award=self.award,
            actor=self.sponsor,
            signer=self.sponsor_member.public_wallet,
            action="PAY",
            idempotency_key=uuid4(),
            intent={},
            status="UNKNOWN",
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        cookie = self.session_cookie(self.sponsor)
        self.run_browser_flow(
            lambda browser: self.check_unknown_status(browser, cookie, operation.pk)
        )

    async def check_unknown_status(self, browser, cookie, operation_id):
        context, page = await self.page_as(browser, cookie)
        await page.goto(self.award_url())
        refreshed = []

        async def status(route):
            refreshed.append(route.request.url)
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "operation_id": str(operation_id),
                        "status": "UNKNOWN",
                        "transaction_hash": None,
                        "error_code": None,
                    }
                ),
            )

        await page.route(f"**/operations/{operation_id}/", status)
        await page.get_by_role("button", name="Refresh status").click()
        message = page.locator("[data-chain-message]")
        await message.get_by_text("Outcome not confirmed (UNKNOWN)").wait_for()
        self.assertTrue(refreshed)
        self.assertNotIn("Action confirmed", await message.inner_text())
        await context.close()
