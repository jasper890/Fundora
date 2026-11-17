import { AppShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { WalletCheckClient } from "@/components/WalletCheckClient";

export default function WalletCheckPage() {
  return (
    <AppShell>
      <PageHeading
        title="Wallet check"
        lead="Connection only. This page never prepares a transaction."
      />
      <WalletCheckClient />
    </AppShell>
  );
}
