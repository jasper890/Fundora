import type { ReviewNote } from "@/lib/awards/queries";

const singaporeTime = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

const KIND: Record<ReviewNote["kind"], string> = {
  REQUEST_CHANGES: "Changes requested by the verifier",
  DISPUTE: "Review of a decision requested by the recipient",
};

/** Change requests and disputes; private to the award's sponsor, verifier and recipient. They do not change the award on-chain. */
export function ReviewNotes({ notes }: { notes: ReviewNote[] }) {
  if (notes.length === 0) return <p className="lead">No change requests or disputes.</p>;
  return (
    <ol className="evidence-history">
      {notes.map((note) => (
        <li key={note.id} className="award-section">
          <h3>{KIND[note.kind]}</h3>
          <p className="lead">
            {note.author_username} · about revision {note.evidence_revision} · {singaporeTime.format(new Date(note.created_at))}
          </p>
          <p>{note.note}</p>
          {note.source_check ? <p>Checked: {note.source_check}</p> : null}
        </li>
      ))}
    </ol>
  );
}
