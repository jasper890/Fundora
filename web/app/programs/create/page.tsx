import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { loadProjectVerifierOptions } from "@/lib/awards/projectCreation";
import { requireSessionUser } from "@/lib/session";

export default async function CreateProjectPage() {
  const user = await requireSessionUser();
  const options = await loadProjectVerifierOptions(user.id).catch(() => null);
  return (
    <AppShell username={user.username} isStaff={user.is_staff}>
      <p><Link href="/programs">← Projects</Link></p>
      <PageHeading title="Create project" lead="Define the activity, what counts as completion, and who will verify it. Funds are set aside later when you fund an award." />
      {options?.length ? (
        <CreateProjectForm verifiers={options.map(({ id, username, program_title }) => ({
          id, label: `${username} · ${program_title}`,
        }))} />
      ) : (
        <Notice>{options ? "Project creation requires an active sponsor assignment and an independent verifier on a project you already sponsor." : "Project setup is temporarily unavailable."}</Notice>
      )}
    </AppShell>
  );
}
