import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginForm } from "../LoginForm";
import { PageHeading } from "@/components/PageHeading";
import { TestnetBanner } from "@/components/TestnetBanner";

const DOORS: Record<
  string,
  { label: string; explain: string }
> = {
  sponsor: {
    label: "Sponsor",
    explain:
      "This door is for the sponsor workspace. Signing in does not grant sponsor access by itself.",
  },
  verifier: {
    label: "Verifier",
    explain:
      "This door is for the verifier workspace. Signing in does not grant verifier access by itself.",
  },
  recipient: {
    label: "Recipient",
    explain:
      "This door is for the recipient workspace. Signing in does not grant recipient access by itself.",
  },
  administrator: {
    label: "Administrator",
    explain:
      "This door is for program administration. Administrators cannot move funds or open private evidence.",
  },
};

export default async function LoginDoorPage({
  params,
}: {
  params: Promise<{ door: string }>;
}) {
  const { door } = await params;
  const meta = DOORS[door];
  if (!meta) notFound();

  return (
    <>
      <TestnetBanner />
      <main className="auth-card" id="main">
        <p className="lead" style={{ marginBottom: "0.75rem" }}>
          <Link href="/">← All workspaces</Link>
        </p>
        <PageHeading
          title={`${meta.label} sign in`}
          lead={meta.explain}
        />
        <LoginForm door={door} />
        <p className="demo-label">
          Demo · Testnet XLM — no real monetary value · no public signup
        </p>
      </main>
    </>
  );
}
