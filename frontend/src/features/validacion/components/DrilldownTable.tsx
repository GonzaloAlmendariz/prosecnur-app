import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useState } from "react";

// =============================================================================
// DrilldownTable — tabla compacta para drill-downs y resultados tabulares
// =============================================================================
// Input: array de rows genéricos (Record<string, unknown>). Detecta las
// columnas dinámicamente de la unión de keys, ordena alfabéticamente, y
// aplica width máximo + truncado con tooltip.
//
// Basada en @tanstack/react-table para sorting; sin virtualización por
// ahora (suficiente para hasta ~500 filas — si hace falta más, agregamos
// `@tanstack/react-virtual` en otro sprint).

type Props = {
  rows: Array<Record<string, unknown>>;
  /** Orden preferido de columnas. Las no listadas van al final. */
  preferredOrder?: string[];
  /** Callback al click en una fila (opcional, para drill adicional). */
  onRowClick?: (row: Record<string, unknown>) => void;
  emptyHint?: string;
  maxHeight?: number;
};

export default function DrilldownTable({
  rows,
  preferredOrder,
  onRowClick,
  emptyHint = "Sin filas para mostrar.",
  maxHeight = 420,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!rows || rows.length === 0) return [];
    const keys = Array.from(
      new Set(rows.flatMap((r) => Object.keys(r))),
    );
    const ordered: string[] = [];
    if (preferredOrder) {
      for (const p of preferredOrder) if (keys.includes(p)) ordered.push(p);
    }
    for (const k of keys) if (!ordered.includes(k)) ordered.push(k);
    return ordered.map((k) => ({
      id: k,
      accessorKey: k,
      header: k,
      cell: (info) => {
        const v = info.getValue();
        if (v == null) return <span style={{ color: "var(--pulso-text-soft)" }}>—</span>;
        const s = typeof v === "object" ? JSON.stringify(v) : String(v);
        return (
          <span
            title={s}
            style={{
              display: "inline-block",
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              verticalAlign: "top",
            }}
          >
            {s}
          </span>
        );
      },
    }));
  }, [rows, preferredOrder]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!rows || rows.length === 0) {
    return (
      <div
        style={{
          padding: "20px 16px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--pulso-text-soft)",
          fontStyle: "italic",
          border: "1px dashed var(--pulso-border)",
          borderRadius: 8,
        }}
      >
        {emptyHint}
      </div>
    );
  }

  return (
    <div
      style={{
        overflow: "auto",
        maxHeight,
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        background: "white",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
        }}
      >
        <thead
          style={{
            position: "sticky",
            top: 0,
            background: "var(--pulso-surface-2)",
            zIndex: 1,
          }}
        >
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort();
                const sort = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--pulso-border)",
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                      color: "var(--pulso-text-soft)",
                      cursor: canSort ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {sort === "asc" ? " ↑" : sort === "desc" ? " ↓" : ""}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              style={{
                borderBottom: "1px solid var(--pulso-surface-2)",
                cursor: onRowClick ? "pointer" : "default",
                transition: "background 120ms ease",
              }}
              onMouseEnter={
                onRowClick
                  ? (e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        "var(--pulso-primary-soft)";
                    }
                  : undefined
              }
              onMouseLeave={
                onRowClick
                  ? (e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "white";
                    }
                  : undefined
              }
            >
              {row.getVisibleCells().map((c) => (
                <td
                  key={c.id}
                  style={{
                    padding: "6px 12px",
                    verticalAlign: "top",
                  }}
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
