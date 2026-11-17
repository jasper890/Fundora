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
          <p className="brand">
            ProofPay<span>.</span>
          </p>
          <nav aria-label="Primary">
            <Link
              href="/programs"
              aria-current={navCurrent(pathname, "/programs") ? "page" : undefined}
            >
              Programs
            </Link>
            <Link
              href="/wallet-check"
              aria-current={
                navCurrent(pathname, "/wallet-check") ? "page" : undefined
              }
            >
              Wallet check
            </Link>
            <Link
              href="/password-change"
              aria-current={
                navCurrent(pathname, "/password-change") ? "page" : undefined
              }
            >
              Account
            </Link>
            {isStaff ? (
              <Link
                href="/admin"
                aria-current={navCurrent(pathname, "/admin") ? "page" : undefined}
              >
                Admin
              </Link>
            ) : null}
          </nav>
          {(username || roleLabel) && (
            <div className="sidebar-user">
              {username && <div>{username}</div>}
              {roleLabel && <div>{roleLabel}</div>}
              <div className="sidebar-signout">
                <SignOutButton />
              </div>
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
