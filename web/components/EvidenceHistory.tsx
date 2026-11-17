import type { EvidenceHistoryItem } from "@/lib/awards/queries";

const singaporeTime = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

export function EvidenceHistory({ versions }: { versions: EvidenceHistoryItem[] }) {
  if (versions.length === 0) return <p className="lead">No evidence history is available.</p>;
  return (
    <ol className="evidence-history">
      {versions.map((version) => (
        <li key={version.id} className="award-section">
          <h3>Revision {version.revision}</h3>
          <p className="lead">Added {singaporeTime.format(new Date(version.created_at))}</p>
          <p>{version.explanation}</p>
          {version.source_ref ? <p>Source reference: {version.source_ref}</p> : null}
          <p><small>Digest: <code>{version.digest}</code></small></p>
          {version.files.length > 0 ? (
            <ul>
              {version.files.map((file) => (
                <li key={file.id}>
                  <a href={`/api/v1/evidence/${file.id}/download`}>{file.filename}</a>
                  <small> · {file.content_type} · {Math.ceil(file.size / 1024)} KB</small>
                </li>
              ))}
            </ul>
          ) : <p className="lead">No retained files for this revision.</p>}
        </li>
      ))}
    </ol>
  );
}
