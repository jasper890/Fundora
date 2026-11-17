import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";
import { requireSessionUser } from "@/lib/session";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  return (
    <AppShell username={user.username} roleLabel="VERIFIER">
      <p className="lead">
        <Link href={`/awards/${id}`}>← Award</Link>
      </p>
      <PageHeading
        title="Review revision"
        lead="Confirm the original source before you prepare an on-chain decision."
      />
      <Notice>
        Off-chain review recording API continues next. Labels match the product
        form: Original source checked, Action to review.
      </Notice>
      <form style={{ marginTop: "1.25rem", maxWidth: 480 }}>
        <div className="field">
          <label>
            <input type="checkbox" name="source_confirmed" /> Original source
            checked
          </label>
        </div>
        <Field label="Action to review" name="action" defaultValue="APPROVE" />
        <Field label="Rationale" name="rationale" />
        <Button type="button" disabled>
          Request a review
        </Button>
      </form>
    </AppShell>
  );
}
