import { AppShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { Notice } from "@/components/Notice";

export default function WalletCheckPage() {
  return (
    <AppShell>
      <PageHeading
        title="Wallet check"
        lead="Connection only. This page never prepares a transaction."
      />
      <Notice>
        Freighter / Varial Testnet connection UI is wired in the wallet phase.
        Assigned address checks use requireAssignedWallet.
      </Notice>
    </AppShell>
  );
}
