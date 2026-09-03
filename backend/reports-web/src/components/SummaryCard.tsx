type Props = { label: string; value: string; color?: string };

export default function SummaryCard({ label, value, color }: Props) {
  return (
    <div className="summary-tile">
      <div className="summary-tile-label">{label}</div>
      <div className="summary-tile-value" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
