type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string; // rendered as the empty-value option, e.g. "All Sites"
};

// A labelled dropdown for filtering a report by one of many options (site,
// supervisor, ...). Swaps in for a chip row once the list gets long — one
// click and scan instead of hunting through wrapped rows of buttons.
export default function SelectField({ label, value, onChange, options, placeholder }: Props) {
  return (
    <div className="select-field">
      <div className="field-label">{label}</div>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
