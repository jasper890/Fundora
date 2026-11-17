import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { SkipLink } from "@/components/SkipLink";
import { TestnetBanner } from "@/components/TestnetBanner";

const DOORS = [
  {
    slug: "sponsor",
    number: "01",
    title: "Keep the cohort moving",
    body: "Fund awards and release approved stipends.",
  },
  {
    slug: "verifier",
    number: "02",
    title: "Give every submission a careful look",
    body: "Inspect evidence and record independent decisions.",
  },
  {
    slug: "recipient",
    number: "03",
    title: "Know your next step",
    body: "Submit evidence and follow your own award.",
  },
  {
    slug: "administrator",
    number: "04",
    title: "Help the program run smoothly",
    body: "Provision members and manage program access.",
  },
] as const;

export default function EntryPage() {
  return (
    <>
      <SkipLink />
      <TestnetBanner />
      <main className="entry-page" id="main">
        <div className="entry-masthead">
          <Link className="brand" href="/" aria-label="ProofPay home">
            <span className="brand-mark" aria-hidden="true">P</span>
            <span>
              ProofPay<span className="brand-period">.</span>
            </span>
          </Link>
          <span className="entry-environment">
            <span className="banner-signal" aria-hidden="true" />
            Provisioned access only
          </span>
        </div>
        <PageHeading
          title="Choose your workspace"
          lead="Each door explains a job. Signing in does not grant that role — only a provisioned membership does. There is no public signup."
        />
        <div className="entry-grid">
          {DOORS.map((door) => (
            <section key={door.slug} className="workspace-door">
              <span className="door-number" aria-hidden="true">
                {door.number}
              </span>
              <h2>{door.slug[0]!.toUpperCase() + door.slug.slice(1)}</h2>
              <p className="door-title">{door.title}</p>
              <p>{door.body}</p>
              <Link className="button" href={"/login/" + door.slug}>
                Continue as {door.slug}
                <span aria-hidden="true">→</span>
              </Link>
            </section>
          ))}
        </div>
        <p className="demo-label">
          Demo · Testnet XLM — no real monetary value · provisioned accounts only
        </p>
      </main>
    </>
  );
}
