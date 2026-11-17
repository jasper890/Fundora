import { AppShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { Notice } from "@/components/Notice";

export default function PasswordChangePage() {
  return (
    <AppShell>
      <PageHeading
        title="Change password"
        lead="Current password is required. Labels match the provisioned account form."
      />
      <Notice>
        Password change API lands with the authenticated session routes once
        the local Supabase stack is seeded.
      </Notice>
    </AppShell>
  );
}
