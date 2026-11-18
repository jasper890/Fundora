import { BrandLink } from "@/components/BrandLink";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { SkipLink } from "@/components/SkipLink";
import { TestnetBanner } from "@/components/TestnetBanner";

const DOORS = [
  {
    slug: "sponsor",
    number: "01",
    title: "Fund community projects",
    body: "Fund awards and release approved payments.",
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
    title: "Manage project access",
    body: "Provision members and manage project access.",
  },
] as const;

export default function EntryPage() {
  return (
    <>
      <SkipLink />
      <TestnetBanner />
      <main className="entry-page" id="main">
        <div className="entry-masthead">
          <BrandLink href="/" />
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
      </main>
    </>
  );
}
