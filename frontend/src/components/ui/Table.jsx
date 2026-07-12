
// Lightweight table shell — columns own their own cell rendering, this just
// standardizes the chrome (header style, row hover/dividers, empty state).
// <Table columns={[{key,label,render?,align?}]} rows={data} rowKey={r => r.id} />
// `minWidth` defaults to the full-page tuning (560px); narrower hosts (e.g.
// the assistant's chat bubbles) can pass a smaller value so 2-3 column
// tables don't force horizontal scroll unnecessarily. `dense` tightens
// padding/font-size for the same narrow contexts.
export function Table({ columns, rows, rowKey, onRowClick, emptyLabel = 'Nothing here yet.', className = '', minWidth = '560px', dense = false }) {
  if (!rows || rows.length === 0) {
    return <div className="py-12 text-center text-sm text-subtle">{emptyLabel}</div>;
  }
  const cellPad = dense ? 'px-2 py-1.5' : 'px-3 py-3';
  const headPad = dense ? 'px-2 py-1.5' : 'px-3 py-2.5';
  const textSize = dense ? 'text-xs' : 'text-sm';
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className={`w-full text-left ${textSize}`} style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-subtle">
            {columns.map((col) => (
              <th key={col.key} className={`whitespace-nowrap ${headPad} ${col.align === 'right' ? 'text-right' : ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-tint/[0.04]' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`whitespace-nowrap ${cellPad} text-fg ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
