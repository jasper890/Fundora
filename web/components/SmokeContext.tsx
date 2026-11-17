type Props = {
  username: string;
  roleLabel: string;
  assignedWallet: string | null;
  nextStepText: string;
  awardStatus: string;
};

export function SmokeContext({
  username,
  roleLabel,
  assignedWallet,
  nextStepText,
  awardStatus,
}: Props) {
  return (
    <aside className="smoke-context" aria-label="Testing context">
      <p>
        <strong>{username}</strong> · {roleLabel} · status {awardStatus}
      </p>
      <p className="smoke-context-step">{nextStepText}</p>
      {assignedWallet ? (
        <p className="mono-clip">
          Freighter must match {assignedWallet.slice(0, 8)}…{assignedWallet.slice(-4)}
        </p>
      ) : null}
    </aside>
  );
}
