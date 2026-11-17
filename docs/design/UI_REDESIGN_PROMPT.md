# ProofPay UI redesign prompt

Use the following prompt when beginning the redesign. The reference image is [UI_INSPO_PROOFPAY.jpg](UI_INSPO_PROOFPAY.jpg).

---

Act as a senior product designer, design systems engineer, and Django frontend engineer experienced in financial workflows, accessibility, and Figma. Redesign ProofPay across every required screen and interaction state using `docs/design/UI_INSPO_PROOFPAY.jpg` as the primary visual reference. Produce a polished, coherent interface that closely matches the reference's visual language and accurately represents ProofPay's documented behavior.

## Establish the product and screen inventory

Read `AGENTS.md`, `README.md`, `docs/ENGINEERING_STANDARD.md`, the four authoritative handoff documents linked there, and `docs/UI_DESIGN_TOOLING.md`. Inspect the current routes, templates, shared includes, presentation helpers, forms, CSS, wallet flow, and verification records. Read `docs/BRAND_EXPLORATION.md` and existing wireframes if present. The supplied image takes priority for visual direction; authoritative product documents and permissions govern behavior.

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

## Preserve the real workflow

ProofPay is a private Stellar Testnet stipend web app with sponsor, recipient and verifier roles. Enforce role and object permissions in both rendering and existing server behavior. A sponsor funds an award, a recipient submits private evidence, a verifier independently reviews it, and the sponsor separately authorizes payment. Preserve the exact contract transitions, deadlines, holds, immutable destinations and recovery rules in the system plan.

Calculate counts and activity from authorized records. Show money and award states from confirmed chain results. Keep requested, prepared, signed, submitted, unknown, failed and confirmed outcomes visibly distinct. A wallet signature or evidence approval alone cannot produce a paid state. Keep the recipient destination read-only in payment previews. Read access must remain usable without forcing a wallet connection.

Make the Testnet label persistent and understandable. Keep private evidence behind existing access checks. Use synthetic identities in mockups. Show actions only to permitted roles; contextual disabled states should explain unmet prerequisites. Treat decorative reference items such as “Invite participants,” Settings, or a workspace guide as candidates to map to existing functionality, not authorization to invent new features or dead controls.

## Build a reusable system

Define shared tokens for colors, type, spacing, radii, borders, shadows and breakpoints. Reuse the current Django template includes and presentation helpers where suitable. Establish shared app shell, sidebar, header, page heading, button, field, badge, metric card, timeline, attention row, table, evidence item, audit entry, transaction preview and feedback patterns. Reuse each pattern across all roles with consistent variants and semantics. Avoid page-specific copies of the same component.

Read the installed `.agents/skills/daisyui/SKILL.md` and relevant component guides for this work. Inspect the actual CSS/build setup before applying library classes. If adopting daisyUI, first record a minimal Tailwind/daisyUI integration and migration plan, check current version-matched APIs with Context7 and primary docs, then ensure the styles build and render. Existing static CSS remains a valid implementation choice when it achieves the requested design with less disruption. Skill installation alone does not provide runtime styles.

Use Figma MCP when it helps create reusable components, variants and reviewable frames; verify the connected account and target file before editing. Use applicable design, accessibility and browser tools deliberately. Keep the reference image primary; Apple HIG principles may inform usability, subject to the resource restrictions in `docs/UI_DESIGN_TOOLING.md`.

## Complete and verify

Include empty, loading, validation, permission, wallet-unavailable, incorrect-account/network, RPC-offline, signing-cancelled, unknown-outcome, failed and confirmed states wherever relevant. Preserve form input after recoverable failures. Provide explicit labels, keyboard access, visible focus, sufficient contrast, non-color status cues, reduced-motion support and layouts that tolerate zoom and long content.

Work in reviewable checkpoints: inventory and visual system, shared shell/components, role screens and flows, then responsive/accessibility and visual verification. After each checkpoint, report the current phase, completed work, next phase and remaining work. Follow the repository's OpenSpec process and existing Git/push authorization.

Verify each inventory row against its requirement and implemented flow. Compare screenshots with the inspiration at a comparable desktop viewport and inspect tablet/mobile layouts. Check each role's access and actions, required UI states, existing behavior and relevant regression checks. Fix visual and functional mismatches before claiming completion. Report actual evidence, visual deviations, missing backend support, unverified wallet/network behavior and remaining work. Deliver the updated interface, reusable component/token inventory, screen coverage matrix and verification record; a single polished overview is insufficient.
