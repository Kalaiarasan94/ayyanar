export type DateFilterMode = 'single' | 'range' | 'all' | 'month';

type Props = {
  mode: DateFilterMode;
  onModeChange: (mode: DateFilterMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  // Range mode's Apply button (and the quick presets below) call this with an
  // explicit {from, to} — never relying on state that may not have committed
  // yet — the same explicit-argument pattern every other data-fetch in this
  // app already uses.
  onApplyRange: (from?: string, to?: string) => void;
  // Opt-in: adds a "Month" chip with a native month picker (whole calendar
  // month, not just today's date) — only where a page asks for it.
  enableMonth?: boolean;
};

const toIso = (d: Date) => d.toISOString().split('T')[0];
const todayIso = () => toIso(new Date());
const yesterdayIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toIso(d);
};
const daysAgoIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIso(d);
};
const firstDayOfMonthIso = () => {
  const d = new Date();
  return toIso(new Date(d.getFullYear(), d.getMonth(), 1));
};

// The standard "Single Date / Date Range / All Time" filter used across every
// reports-web page — one calendar picker, one interaction model everywhere.
export default function DateFilterBar({ mode, onModeChange, date, onDateChange, from, to, onFromChange, onToChange, onApplyRange, enableMonth }: Props) {
  return (
    <>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button className={`chip${mode === 'single' ? ' active' : ''}`} onClick={() => onModeChange('single')}>
          Single Date
        </button>
        {enableMonth && (
          <button className={`chip${mode === 'month' ? ' active' : ''}`} onClick={() => onModeChange('month')}>
            Month
          </button>
        )}
        <button className={`chip${mode === 'range' ? ' active' : ''}`} onClick={() => onModeChange('range')}>
          Date Range
        </button>
        <button className={`chip${mode === 'all' ? ' active' : ''}`} onClick={() => onModeChange('all')}>
          All Time
        </button>
      </div>

      <div className="toolbar" style={{ marginBottom: 18 }}>
        {mode === 'month' && (
          <div className="date-input-group">
            <input
              type="month"
              className="input"
              value={date.slice(0, 7)}
              onChange={(e) => {
                if (!e.target.value) return;
                const [y, m] = e.target.value.split('-').map(Number);
                const first = toIso(new Date(y, m - 1, 1));
                const last = toIso(new Date(y, m, 0));
                onDateChange(first);
                onFromChange(first);
                onToChange(last);
                onApplyRange(first, last);
              }}
            />
          </div>
        )}

        {mode === 'single' && (
          <div className="date-input-group">
            <input type="date" className="input" value={date} onChange={(e) => onDateChange(e.target.value)} />
            <button className="btn secondary" onClick={() => onDateChange(todayIso())}>
              Today
            </button>
            <button className="btn secondary" onClick={() => onDateChange(yesterdayIso())}>
              Yesterday
            </button>
          </div>
        )}

        {mode === 'range' && (
          <div className="date-range-picker">
            <div className="date-input-group">
              <input type="date" className="input" value={from} onChange={(e) => onFromChange(e.target.value)} aria-label="From date" />
              <span className="text-muted">to</span>
              <input type="date" className="input" value={to} onChange={(e) => onToChange(e.target.value)} aria-label="To date" />
            </div>
            <div className="date-action-group">
              <button className="btn" onClick={() => onApplyRange()}>
                Apply
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  const f = daysAgoIso(7);
                  const t = todayIso();
                  onFromChange(f);
                  onToChange(t);
                  onApplyRange(f, t);
                }}
              >
                Last 7 Days
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  const f = firstDayOfMonthIso();
                  const t = todayIso();
                  onFromChange(f);
                  onToChange(t);
                  onApplyRange(f, t);
                }}
              >
                This Month
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
