import { Printer } from 'lucide-react';

// Triggers the browser's native print dialog. Paired with the `@media print`
// rules in styles.css, which hide the sidebar/header/toolbars so only the
// report content (title, summary cards, charts, tables) ends up on paper.
export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" className="btn secondary no-print" onClick={() => window.print()}>
      <Printer size={16} />
      {label}
    </button>
  );
}
