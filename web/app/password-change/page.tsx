import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { requireSessionUser } from "@/lib/session";

export default async function PasswordChangePage() {
  const user = await requireSessionUser({ allowMustChangePassword: true });
  return (
    <AppShell username={user.username} roleLabel={user.is_staff ? "ADMIN" : undefined} isStaff={user.is_staff}>
      <PageHeading
        title="Set your password"
        lead="For account security, change the temporary password before continuing."
      />
      <Notice>Use your current temporary password and choose a new password of at least 8 characters.</Notice>
      <section className="award-section"><PasswordChangeForm /></section>
    </AppShell>
  );
}
