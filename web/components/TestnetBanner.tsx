export function TestnetBanner() {
  return (
    <div className="testnet-banner" role="status">
      <span className="banner-signal" aria-hidden="true" />
      <strong>TESTNET XLM</strong>
      <span className="banner-divider" aria-hidden="true">·</span>
      <span>No real monetary value</span>
    </div>
  );
}
