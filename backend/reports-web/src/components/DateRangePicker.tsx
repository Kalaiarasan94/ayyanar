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
    <div className="toolbar date-range-picker">
      <div className="date-input-group">
        <input type="date" className="input" value={from} onChange={(e) => onFromChange(e.target.value)} aria-label="From date" />
        <span className="text-muted date-sep">to</span>
        <input type="date" className="input" value={to} onChange={(e) => onToChange(e.target.value)} aria-label="To date" />
      </div>
      <div className="date-action-group">
        <button className="btn" onClick={onApply}>
          Apply
        </button>
        {onClear && (
          <button className="btn secondary" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

