import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sourceSerif = localFont({
  src: [
    {
      path: "../fonts/source-serif-4-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/source-serif-4-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-serif",
  display: "swap",
});

const sourceSans = localFont({
  src: [
    {
      path: "../fonts/source-sans-3-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/source-sans-3-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/source-sans-3-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProofPay",
  description:
    "Private Stellar Testnet stipend awards — demo only, no real monetary value.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${sourceSans.variable}`}>
      <body style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
        {children}
      </body>
    </html>
  );
}
