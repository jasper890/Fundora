"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import { SkipLink } from "./SkipLink";
import { TestnetBanner } from "./TestnetBanner";

type Props = {
  children: React.ReactNode;
  username?: string;
  roleLabel?: string;
  isStaff?: boolean;
};

function navCurrent(pathname: string, href: string): boolean {
  if (href === "/programs") {
    return pathname === "/programs" || pathname.startsWith("/programs/");
  }
  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, username, roleLabel, isStaff }: Props) {
  const pathname = usePathname() || "/";

  return (
    <>
      <SkipLink />
      <TestnetBanner />
      <div className="app-shell">
        <aside className="sidebar">
          <Link className="brand" href="/programs" aria-label="ProofPay home">
            <span className="brand-mark" aria-hidden="true">P</span>
            <span>
              ProofPay<span className="brand-period">.</span>
            </span>
          </Link>
          <p className="sidebar-context">WORKSPACE</p>
          {roleLabel ? <p className="sidebar-role">{roleLabel}</p> : null}
          <nav aria-label="Primary">
            <Link
              href="/programs"
              aria-current={navCurrent(pathname, "/programs") ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
                  <rect x="11.5" y="3" width="5.5" height="5.5" rx="1" />
                  <rect x="3" y="11.5" width="5.5" height="5.5" rx="1" />
                  <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1" />
                </svg>
              </span>
              <span>Programs</span>
            </Link>
            <Link
              href="/wallet-check"
              aria-current={
                navCurrent(pathname, "/wallet-check") ? "page" : undefined
              }
            >
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none">
                  <path d="M3 6.5h12.5A1.5 1.5 0 0 1 17 8v7.5H4.5A1.5 1.5 0 0 1 3 14V5.5A2.5 2.5 0 0 1 5.5 3H15" />
                  <path d="M13.5 10.5h3.25M6 6.5V5" />
                  <circle cx="13.4" cy="10.5" r=".5" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span>Wallet check</span>
            </Link>
            <Link
              href="/password-change"
              aria-current={
                navCurrent(pathname, "/password-change") ? "page" : undefined
              }
            >
              <span className="nav-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="6.5" r="3" />
                  <path d="M3.5 17c.55-3 2.7-4.5 6.5-4.5s5.95 1.5 6.5 4.5" />
                </svg>
              </span>
              <span>Account</span>
            </Link>
            {isStaff ? (
              <Link
                href="/admin"
                aria-current={navCurrent(pathname, "/admin") ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none">
                    <path d="M10 2.5 16 4.7v4.1c0 4.3-2.5 7-6 8.7-3.5-1.7-6-4.4-6-8.7V4.7l6-2.2Z" />
                    <path d="m7.4 9.7 1.7 1.7 3.6-3.8" />
                  </svg>
                </span>
                <span>Admin</span>
              </Link>
            ) : null}
          </nav>
          {(username || roleLabel) && (
            <div className="sidebar-user">
              <span className="sidebar-avatar" aria-hidden="true">
                {username?.trim().charAt(0).toUpperCase() || "P"}
              </span>
              {username ? (
                <span className="sidebar-username">{username}</span>
              ) : null}
              <span className="sidebar-user-role">
                {roleLabel ?? "Workspace member"}
              </span>
              <div className="sidebar-signout">
                <SignOutButton />
              </div>
            </div>
          )}
        </aside>
        <div className="main" id="main">
          <header className="topbar">
            <div className="topbar-context">
              <span className="topbar-eyebrow">PROOFPAY · PRIVATE WORKSPACE</span>
              <span className="topbar-title">Stipend award workflow</span>
            </div>
            <span className="topbar-role">{roleLabel ?? "TESTNET WORKSPACE"}</span>
          </header>
          {children}
          <p className="demo-label">
            Simulated workshop · Testnet XLM has no real monetary value
          </p>
        </div>
      </div>
    </>
  );
}
