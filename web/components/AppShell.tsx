import Link from "next/link";
import { SkipLink } from "./SkipLink";
import { TestnetBanner } from "./TestnetBanner";

type Props = {
  children: React.ReactNode;
  username?: string;
  roleLabel?: string;
};

export function AppShell({ children, username, roleLabel }: Props) {
  return (
    <>
      <SkipLink />
      <TestnetBanner />
      <div className="app-shell">
        <aside className="sidebar">
          <p className="brand">
            ProofPay<span>.</span>
          </p>
          <nav aria-label="Primary">
            <Link href="/programs" aria-current="page">
              Programs
            </Link>
            <Link href="/wallet-check">Wallet check</Link>
            <Link href="/password-change">Account</Link>
          </nav>
          {(username || roleLabel) && (
            <div style={{ marginTop: "2rem", fontSize: "0.8rem" }}>
              {username && <div>{username}</div>}
              {roleLabel && <div>{roleLabel}</div>}
            </div>
          )}
        </aside>
        <div className="main" id="main">
          {children}
          <p className="demo-label">
            Simulated workshop · Testnet XLM has no real monetary value
          </p>
        </div>
      </div>
    </>
  );
}
