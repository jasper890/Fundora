# ProofPay brand exploration

Research date: 16 November 2026. Status: design recommendation, not an approved rename or implemented interface. Inputs: product/scope, architecture guide and system plan §5. Engineering requirements and contract states remain authoritative.

## Research and interpretation

These are desk-research findings, not interviews with ProofPay users. No popularity ranking or trend adoption rate was established.

| Primary source, retrieved 16 November 2026 | Observed finding | Application to ProofPay: our interpretation |
|---|---|---|
| [Wise transfer completion explanation](https://wise.com/help/articles/2977950/why-does-it-say-my-transfers-complete-when-the-money-hasnt-arrived-yet) | Wise distinguishes its transfer-completion milestone from the receiving bank making money available | Define exactly what Paid means here: confirmed native Testnet XLM transfer, never bank receipt or fiat cash-out |
| [GOV.UK task list](https://design-system.service.gov.uk/components/task-list/) and [tag component](https://design-system.service.gov.uk/components/tag/) | Short task descriptions and explicit statuses; tags describe state and are not buttons | Separate readable state labels from action buttons. Our contract steps are ordered, unlike freely ordered form tasks |
| [Government task-list research](https://designnotes.blog.gov.uk/2023/12/15/working-as-a-community-to-iterate-the-task-list-pattern/) | Research-led changes improved tag readability and removed uppercase styling | Prefer sentence case, readable labels and pale status backgrounds; validate with our users rather than importing the entire government style |
| [Submittable applicant guidance](https://next.support.submittable.com/hc/en-us/articles/41242987982231-Applicant-FAQs) | Submitted, under review, selected and awarded are distinct milestones; changes depend on program actions | Show who acts next. Approval and payment are separate events. Do not copy Submittable's lifecycle into our contract |
| [Linear brand guidance](https://linear.app/brand) and [product method](https://linear.app/method) | The brand specifies consistent naming and asset use; product guidance emphasizes scoped work | Use a repeatable visual system and a small role-focused workspace. This is not evidence that dark dashboards fit stipend recipients |
| [Pentagram Mastercard identity](https://www.pentagram.com/work/mastercard) | One simple motif is used consistently across contexts | Build an original motif from ProofPay's handoff sequence; do not copy Mastercard circles or brand assets |

Wise's design-system site required JavaScript and its linked documentation returned a 404 during this research; no detailed Wise component audit is claimed. Product help content was readable. No forum anecdotes or unverified trend claims are used as evidence.

## Three proposed directions

Names are creative candidates, not cleared trademarks or available domains. Taglines describe intent, not a payment guarantee.

### A. The Handoff — recommended visual direction

Position: a clear shared record of who has done what and who acts next. Name options: retain **ProofPay** with descriptor “Training stipend workspace”; explore **Handoff** or **Awardpath** later. Tagline options: “Know the next step.” / “From completion to a clear payment record.”

Voice: calm, specific and accountable. “The verifier approved your submission. The sponsor still needs to release payment.” Avoid celebratory language before payment confirmation.

Palette: warm paper `#F6F3EC`, ink `#202D29`, pine `#245848`, white `#FFFFFF`, ochre `#8B5A10`. Typography: Source Sans 3 for interface and wordmark; Source Serif 4 sparingly for program titles. These are font candidates; verify distribution licenses before bundling.

Original motif: a continuous, square-ended handoff line with named checkpoints. Use it in the award timeline and confirmation receipt. Keep the logo mark static: three short offset strokes, not a checkmark or certification stamp. The mark never implies a live payment status.

- Sponsor: a restrained program register with “Needs your action” first, readable award rows, deadlines and exact amounts. No decorative analytics for ten recipients.
- Verifier: a case-file layout with source-check form and evidence revision together; decision controls stay near the source-check summary.
- Recipient: one clear award page: requirement, amount, next person to act, deadline, evidence and timeline. It should feel like a useful letter, not a trading screen.

State treatment: named checkpoints show submission and approval; a distinct receipt block appears only for confirmed payment. An unresolved transaction adds a prominent text notice above the last confirmed checkpoint, preserving its position. Rejection shows the rationale and available appeal path; never erase earlier events.

Risk: warm editorial styling can feel ceremonial or bureaucratic. Keep typography simple and use evidence from usability testing to tune density.

### B. Common Ground

Position: approachable coordination for training organizers and participants. Name options: **Common Ground** / **CohortPay**. Taglines: “A clearer path for every participant.” / “Training support, step by step.”

Voice: encouraging, direct and non-patronizing. “Your submission is with the verifier.” Avoid judging a person's worth through eligibility or rejection labels.

Palette: ivory `#FFFAF0`, dark cocoa `#352A25`, terracotta `#A4472C`, soft apricot `#F6DDCA`, dark teal `#205D61`. Typography: Atkinson Hyperlegible for the interface; restrained Literata headings, subject to license checks. Motif: adjoining rectangular frames representing the three roles; no stock charity imagery or simulated signatures.

- Sponsor: a cohort list led by names and needs, then amount/status; private by default, no public participant leaderboard.
- Verifier: a guided vertical checklist with one focused award at a time and a compact queue link.
- Recipient: a large “What happens next” message with short sentences and visible help/dispute controls.

State treatment: warm neutral for pending, teal for approved and paid with different explicit labels, plain red-text rationale for rejection. Uncertain payment uses a separate notice saying confirmation is unavailable, never a reassuring completed illustration.

Risk: friendliness could soften the seriousness of signing or imply aid is guaranteed. Show deadlines, sponsor discretion and refund rules clearly.

### C. Clear Record

Position: precise review and payment traceability for program operators. Name options: **Clear Record** / **Stipend Ledger**. Taglines: “Every decision has a record.” / “Review. Release. Refer back.”

Voice: concise and procedural without jargon. “Approval confirmed. Payment not yet released.”

Palette: off-white `#F5F7FA`, midnight `#17263D`, cobalt `#234DB5`, slate `#536276`, pale blue `#E6EDFC`. Typography: IBM Plex Sans; IBM Plex Mono only for identifiers, subject to license checks. Motif: an original reference-tab shape appearing in navigation and receipt headers; no terminal graphics or fake security seals.

- Sponsor: a compact ledger with filters for current state, next action and deadline; reference details expand on demand.
- Verifier: evidence/decision workspace with explicit revision and review history; no hidden bulk approval.
- Recipient: readable progress and receipt view, keeping hashes in optional details.

State treatment: text plus small geometric indicators; approval and paid remain separately named. Unknown uses a persistent outlined alert with last-confirmed timestamp. Rejected shows the decision record and allowed follow-up.

Risk: strongest operator clarity, weakest human warmth; dense tables could discourage first-time recipients. It could also resemble ordinary fintech branding without a carefully developed motif.

## Recommendation

Use A's Handoff visual direction while retaining **ProofPay** as the working name. This minimizes a premature rename and gives us a specific organizing idea: every award shows the next responsible person. This preference is a design judgment, not validated user research. ProofPay's word “proof” may overstate evidence authenticity, so always pair it with a concrete descriptor and test that interpretation before committing to the name.

No design should imply the sponsor must pay immediately after approval. The current system still requires sponsor release and may refund unpaid funds after expiry. Display those conditions before funding and submission.

### Compact style guide for direction A

- Canvas warm paper; white working surfaces; pine for primary actions; ink for body text. Reserve ochre for attention and separate red for rejection/errors. Never use brand color alone to identify status.
- Default body 16px/1.5; main heading 28–32px; secondary headings 20–24px; metadata no smaller than 14px. Tables use tabular numerals; avoid monospace for ordinary amounts.
- Spacing scale 4/8/12/16/24/32/48px. Containers up to 1120px; recipient reading column around 640–720px. Fine borders, 4–8px corners, minimal shadows. No glass effects, glowing gradients, spinning coins or ornamental charts.
- One primary action for the current role and state. Destructive or irreversible actions require an explicit review summary; never hide recipient, amount, asset, fee or action behind a tooltip.
- Static logo and timeline geometry remain distinct from interactive controls. Wordmark first; do not commission a full identity system before testing the three core pages.

### Honest state language across all directions

Render award state, operation status and hold flags separately; they are not one status enum. Last-confirmed state stays visible when a new transaction is unresolved.

| Situation | Main copy | Action/secondary copy |
|---|---|---|
| Created | Award created. Not funded yet. | Sponsor: Review funding |
| Funded, no submission | Award funded. Submission needed. | Recipient: Add completion evidence |
| Files uploaded, not signed | Evidence saved. Submission not yet signed. | Review and sign submission |
| Submission confirmed | Waiting for verifier review. | Show submitted revision and next actor |
| Approval requested, unconfirmed | Approval confirmation pending. | Last confirmed state remains Submitted |
| Approval confirmed | Approved. Waiting for sponsor release. | Sponsor: Review payment; never “Paid” |
| Payout awaiting wallet | Review payment in your wallet. | Signing is not confirmation |
| Payment unresolved | Payment outcome not confirmed. We are checking Stellar. | Refresh status; no duplicate Pay control |
| Payment confirmed | Payment confirmed: 20 Testnet XLM sent to your assigned wallet. | View transaction; not a bank receipt |
| Rejected | Submission rejected by the verifier. | Show permitted rationale and available review/dispute path |
| Hold confirmed | Review hold active. Payment is blocked. | Identify setter and applicable next step; expiry refund remains possible |
| Refunded | Unpaid funds returned to the sponsor. | Recipient did not receive payment |
| Cancelled | Award cancelled before funding. | No stipend funds were deposited |

Always display “Testnet XLM — no real monetary value.” Unknown outcomes must not be renamed Failed. Request changes and dispute requests are off-chain actions; they do not themselves reopen a claim, stop payment or guarantee an appeal outcome.

## Guidance for the future coding agent

Use existing Django templates and the planned wallet bundle. Define CSS tokens in the planned stylesheet; use template includes for status, award summary, next action, timeline and signing preview. Do not introduce a frontend framework for this visual direction. Keep status labels mapped to confirmed data; no optimistic payment-success animation. Do not change ABI, roles, deadline rules or fee behavior for a cleaner composition.

Desktop verifier layout can place source details and decision form side by side. Below approximately 720px, stack in reading order: award context, current revision, source details, decision controls, history. Convert sponsor table rows to labeled cards when they no longer fit; retain every critical field. Avoid sticky mobile controls that cover errors or evidence.

Accessibility targets: at least WCAG AA text contrast, visible keyboard focus, labels and inline errors, no color-only meanings, 44px practical touch targets, 320px-width reflow, zoom support and reduced motion. Use semantic headings/tables; announce confirmation changes with a polite live region without repeatedly reading every poll. Palette values are design candidates, not measured contrast certification. Avoid auto-opening wallets or moving focus on refresh.

## Validation before identity approval

1. Show static sponsor, verifier and recipient compositions to at least two outside testers where possible. This is formative feedback, not market validation.
2. Ask them to identify who acts next, whether approval means payment, what unknown means, and what happens after expiry. Treat misunderstanding of Paid/Unknown as a design failure regardless of aesthetic preference.
3. Compare A and C using the same content and tasks; compare B if testers find A institutional or cold. Do not ask only “Which looks nicest?”
4. Test names for pronunciation, meaning, false certainty and local language associations with intended organizers/recipients. No market/geography has been confirmed. Do not invent a Filipino or global brand persona from the timezone alone.
5. Check relevant trademark registries, domains, app listings and adjacent financial products before a rename. No legal or availability clearance has been performed for any candidate, including ProofPay.

The identity-system lens here draws from Pentagram's documented consistency across touchpoints, not an impersonation of a particular designer. No named strategist or designer reviewed or endorsed this proposal. Logos, production mockups, application changes and user interviews remain future work.
