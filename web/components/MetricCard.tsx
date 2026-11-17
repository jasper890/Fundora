type Props = {
  label: string;
  value: number | string;
  featured?: boolean;
};

export function MetricCard({ label, value, featured }: Props) {
  return (
    <div className={`metric-card${featured ? " featured" : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
