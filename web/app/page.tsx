import Link from "next/link";
import { TestnetBanner } from "@/components/TestnetBanner";
import { PageHeading } from "@/components/PageHeading";

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
      <TestnetBanner />
      <main className="main" id="main" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <PageHeading
          title="Choose your workspace"
          lead="Each door explains a job. Signing in does not grant that role — only a provisioned membership does. There is no public signup."
        />
        <div
          className="entry-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {DOORS.map((door) => (
            <section
              key={door.slug}
              className="auth-card"
              style={{ margin: 0, maxWidth: "none" }}
            >
              <p className="lead" style={{ color: "var(--coral)", marginBottom: "0.5rem" }}>
                {door.number}
              </p>
              <h2 style={{ fontSize: "1.35rem", margin: "0 0 0.75rem" }}>
                {door.slug[0]!.toUpperCase() + door.slug.slice(1)}
              </h2>
              <p className="lead" style={{ marginBottom: "0.5rem" }}>
                {door.title}
              </p>
              <p className="lead">{door.body}</p>
              <p style={{ marginTop: "1.25rem" }}>
                <Link className="button" href={`/login/${door.slug}`}>
                  Continue as {door.slug}
                </Link>
              </p>
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
