import type { ReactNode } from 'react';

export type Column<T> = {
  header: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  totalRow?: ReactNode[];
  rowKey: (row: T, index: number) => string | number;
};

export default function DataTable<T>({ columns, rows, emptyText, totalRow, rowKey }: Props<T>) {
  if (rows.length === 0) {
    return <div className="empty-note">{emptyText || 'No data for this range.'}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} style={{ textAlign: c.align || 'left' }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {columns.map((c) => (
                <td key={c.header} style={{ textAlign: c.align || 'left' }}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {totalRow && (
            <tr className="total-row">
              {totalRow.map((cell, i) => (
                <td key={i} style={{ textAlign: columns[i]?.align || 'left' }}>
                  {cell}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
