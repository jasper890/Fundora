import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeading } from "@/components/PageHeading";
import { Notice } from "@/components/Notice";
import { homeCopy } from "@/lib/presentation";

export default function ProgramsPage() {
  const copy = homeCopy(null);
  return (
    <AppShell>
      <PageHeading
        title={copy.page_title}
        lead="Programs you belong to appear here after you sign in."
      />
      <Notice>
        Connect the local Supabase stack and seed demo accounts to load live
        memberships. Until then this shell is ready for the Next.js + Supabase
        runtime.
      </Notice>
      <EmptyState
        title={copy.register_title}
        body={copy.empty_register}
      />
    </AppShell>
  );
}
