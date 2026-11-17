"use client";

type Props = {
  preview: Record<string, unknown>;
  defaultOpenJson?: boolean;
};

function str(value: unknown): string {
  if (value == null) return "—";
  return String(value);
}

export function ChainPreview({ preview, defaultOpenJson = false }: Props) {
  const action = str(preview.action ?? preview.status);
  const amount = preview.amount_base_units
    ? `${Number(preview.amount_base_units) / 10_000_000} Testnet XLM`
    : null;
  const signer = str(preview.signer);
  const network = str(preview.network ?? "TESTNET");
  const fee = preview.maximum_fee_base_units
    ? str(preview.maximum_fee_base_units)
    : null;
  const mode = str(preview.mode);
  const expected = preview.expected_version != null
    ? str(preview.expected_version)
    : null;

  return (
    <div className="chain-preview" data-chain-message>
      <dl className="chain-preview-summary">
        <div>
          <dt>Action</dt>
          <dd>{action}</dd>
        </div>
        {amount ? (
          <div>
            <dt>Amount</dt>
            <dd>{amount}</dd>
          </div>
        ) : null}
        <div>
          <dt>Network</dt>
          <dd>{network}</dd>
        </div>
        <div>
          <dt>Signer</dt>
          <dd className="mono-clip">{signer}</dd>
        </div>
        {fee ? (
          <div>
            <dt>Max fee (stroops)</dt>
            <dd>{fee}</dd>
          </div>
        ) : null}
        {expected != null ? (
          <div>
            <dt>Expected version</dt>
            <dd>{expected}</dd>
          </div>
        ) : null}
        {mode && mode !== "—" ? (
          <div>
            <dt>Mode</dt>
            <dd>{mode}</dd>
          </div>
        ) : null}
      </dl>
      <details className="chain-preview-json" open={defaultOpenJson}>
        <summary>Technical details</summary>
        <pre>{JSON.stringify(preview, null, 2)}</pre>
      </details>
    </div>
  );
}
