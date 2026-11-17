# ProofPay UI redesign prompt

Use the following prompt when beginning the redesign. The reference image is [UI_INSPO_PROOFPAY.jpg](UI_INSPO_PROOFPAY.jpg).

---

Act as a senior product designer and frontend engineer experienced in financial workflows, accessibility, design systems, and Figma. Build a high fidelity, frontend-only ProofPay mock as a separate web project that runs locally in a browser. Use `docs/design/UI_INSPO_PROOFPAY.jpg` as the primary visual reference. The mock should closely match the reference's visual language and accurately represent ProofPay's documented product behavior.

This deliverable is a local visual prototype, separate from the production-shaped Django application. Put it in an isolated directory such as `ui-mock/`. You may use Next.js, React, or another suitable frontend stack; choose based on the mock's needs rather than treating Django as a constraint. Do not modify or replace the existing Django app. Use local synthetic fixtures and frontend-only interactions to demonstrate flows and states. Do not connect to Django APIs, databases, Stellar RPC, wallets, real accounts, or private evidence, and do not imply that simulated actions changed real records or funds. Keep screen behavior faithful to the system plan while making its simulated nature clear.

## Establish the product and screen inventory

Read `AGENTS.md`, `README.md`, `docs/ENGINEERING_STANDARD.md`, the four authoritative handoff documents linked there, and `docs/UI_DESIGN_TOOLING.md`. Read `docs/BRAND_EXPLORATION.md` and existing wireframes if present. The written product and system documents define the prototype's scope, screens, roles, flows, states, and rules. The inspiration image defines visual direction only.

Treat the current Django app as a rough, incomplete implementation skeleton. Inspect its routes, templates, forms, CSS, wallet flow, and verification records to understand what exists and where gaps remain, but do not use its current UI, route coverage, or behavior as the source of truth. If the skeleton omits, simplifies, or contradicts a documented requirement, follow the authoritative documents and represent the required screen or flow in the mock with clearly simulated frontend behavior. Do not assume an existing implementation is correct merely because it is present, or a requirement is out of scope merely because the skeleton lacks it.

Use the document ownership rules in `docs/ENGINEERING_STANDARD.md`: `ProofPay_Product_and_Scope.md` owns goals, roles, boundaries, and acceptance criteria; `ProofPay_System_and_Implementation_Plan.md` owns architecture, routes, screens, state transitions, and the six tasks; `ProofPay_Repository_Validation.md` and `ProofPay_Agent_Handoff_and_InstaAward_Checklist.md` record source constraints and execution gates. Supporting docs and OpenSpec artifacts remain subordinate. Resolve any genuine conflict by those ownership rules and record it instead of copying the skeleton's interpretation.

Before designing, create a coverage matrix mapping each existing and required screen to its route or flow, user role, source requirement, reusable components, responsive layouts, and required states. Distinguish implemented screens from documented flows that still need backend work. Design those flows accurately and label implementation gaps. Completion requires every inventory item to be accounted for.

Cover at least:

- Role entry, login, logout behavior, password change, and permission-denied/not-found screens.
- Sponsor home, program register, program overview, award register, award creation and immutable terms.
- Recipient home, assigned awards, award detail, private evidence submission and revision, feedback/change requests, and dispute requests.
- Verifier home and review queue, evidence review with source-check checklist, rationale, approve/reject/request-changes/hold actions, and review history.
- Role-specific award detail, terms, evidence history, progress timeline, recovery actions, verifier replacement, refunds, and TTL maintenance where authorized.
- Wallet readiness, account/network mismatch, transaction preview, signing, rejection/cancellation, submission, confirmation, unknown outcome and reconciliation.
- Audit/activity views and authorized private exports. Associate these with existing routes and flows; show missing backend support explicitly.

## Match the inspiration

Inspect the actual image before choosing tokens or components. Preserve its proportions, hierarchy, density, spacing rhythm, alignment, restrained borders and shadows, and distribution of emphasis. Derive a documented palette from the image rather than guessing precise values from memory.

Reproduce these visible characteristics across the system:

- A deep forest green desktop sidebar with a compact ProofPay identity, workspace context, clear navigation groups, ivory active navigation, and an anchored user area.
- A slim, persistent Testnet/demo notice and a light header showing the current program and user role.
- Warm ivory page backgrounds, lighter card surfaces, dark green headings, muted supporting text, and coral/orange emphasis for primary actions.
- Bold page titles, restrained uppercase section labels, compact icon tiles, subtle badges, generous card padding, modest corner rounding, and fine separators.
- Aligned summary cards, attention queues, award progress, recent activity, award tables and terms panels arranged with the same deliberate dashboard hierarchy.
- Consistent avatars, icon sizes, button heights, table rows, status treatments and card headers.

Adapt this language to each screen's purpose. Use representative synthetic content, realistic long labels and addresses, and useful empty states. The screenshot is cropped: design content below its visible area from ProofPay's requirements, and identify extrapolated sections. Desktop should closely resemble the reference; tablet and mobile should preserve its identity with readable stacking, responsive tables, and accessible navigation.

## Represent the documented workflow faithfully

ProofPay is a private Stellar Testnet stipend web app with sponsor, recipient and verifier roles. Represent each role's permitted screens and actions in the mock. A sponsor funds an award, a recipient submits private evidence, a verifier independently reviews it, and the sponsor separately authorizes payment. Preserve the exact contract transitions, deadlines, holds, immutable destinations and recovery rules in the system plan. This prototype demonstrates the interface only; server-side enforcement belongs to the existing Django application.

Use deterministic synthetic data for counts and activity. Visually distinguish confirmed example states from simulated interactions. Keep requested, prepared, signed, submitted, unknown, failed and confirmed outcomes visibly distinct. A wallet signature or evidence approval alone cannot produce a paid state. Keep the recipient destination read-only in payment previews. Reading screens should not appear to require a wallet connection.

Make the Testnet label persistent and understandable, with a clear demo/simulation label wherever actions are simulated. Use synthetic identities and sample evidence. Show actions only on the appropriate role's prototype screens; contextual disabled states should explain unmet prerequisites. Treat decorative reference items such as “Invite participants,” Settings, or a workspace guide as candidates to map to documented functionality, not permission to invent product features or dead controls.

## Build a reusable system

Define shared tokens for colors, type, spacing, radii, borders, shadows and breakpoints. Establish reusable components in the standalone frontend for the app shell, sidebar, header, page heading, button, field, badge, metric card, timeline, attention row, table, evidence item, audit entry, transaction preview and feedback. Reuse each pattern across roles with consistent variants and semantics. Avoid page-specific copies of the same component.

Read the installed `.agents/skills/daisyui/SKILL.md` and relevant component guides. Choose a frontend stack that supports a polished prototype; Next.js is allowed. DaisyUI is optional: if selected, install and configure it inside the isolated mock project, check current version-matched APIs with Context7 and primary docs, and ensure its styles build and render. The skill alone does not provide runtime styles. Do not add UI dependencies to the Django app for this prototype.

Use Figma MCP when it helps create reusable components, variants and reviewable frames; verify the connected account and target file before editing. Use applicable design, accessibility and browser tools deliberately. Keep the reference image primary; Apple HIG principles may inform usability, subject to the resource restrictions in `docs/UI_DESIGN_TOOLING.md`.

## Complete and verify

Include empty, loading, validation, permission, wallet-unavailable, incorrect-account/network, RPC-offline, signing-cancelled, unknown-outcome, failed and confirmed states wherever relevant. Preserve form input after recoverable failures. Provide explicit labels, keyboard access, visible focus, sufficient contrast, non-color status cues, reduced-motion support and layouts that tolerate zoom and long content.

Work in reviewable checkpoints: inventory and visual system, standalone project setup and shared shell/components, role screens and simulated flows, then responsive/accessibility and visual verification. After each checkpoint, report the current phase, completed work, next phase and remaining work. Keep all prototype files isolated from Django application code. Follow the repository's OpenSpec process and existing Git/push authorization.

Run the mock locally and verify it renders in a browser. Compare screenshots with the inspiration at a comparable desktop viewport and inspect tablet/mobile layouts. Check every inventory screen, role-specific view, simulated action and required state. Fix visual and interaction mismatches before claiming completion. Report actual evidence, visual deviations, simulated behavior, backend work intentionally outside this prototype, and remaining work. Deliver the runnable local mock, reusable component/token inventory, screen coverage matrix and verification record; a single polished overview is insufficient.
