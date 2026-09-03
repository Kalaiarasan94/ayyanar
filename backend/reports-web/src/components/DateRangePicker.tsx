type Props = {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: () => void;
  onClear?: () => void;
};

export default function DateRangePicker({ from, to, onFromChange, onToChange, onApply, onClear }: Props) {
  return (
    <div className="toolbar">
      <input type="date" className="input" value={from} onChange={(e) => onFromChange(e.target.value)} />
      <span className="text-muted">to</span>
      <input type="date" className="input" value={to} onChange={(e) => onToChange(e.target.value)} />
      <button className="btn" onClick={onApply}>
        Apply
      </button>
      {onClear && (
        <button className="btn secondary" onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  );
}
