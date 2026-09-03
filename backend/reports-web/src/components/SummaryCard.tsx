import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  color?: string;
  icon?: LucideIcon;
  sub?: string;
};

export default function SummaryCard({ label, value, color, icon: Icon, sub }: Props) {
  return (
    <div className="kpi-card">
      {Icon && (
        <div className="kpi-icon" style={color ? { background: `${color}1a`, color } : undefined}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
      )}
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value" style={color ? { color } : undefined}>
          {value}
        </div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}
