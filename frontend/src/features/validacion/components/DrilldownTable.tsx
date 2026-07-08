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
  /** Diccionario variable -> código -> etiqueta para mostrar respuestas legibles. */
  valueLabels?: Record<string, Record<string, string | null> | null> | null;
  /** Callback al click en una fila (opcional, para drill adicional). */
  onRowClick?: (row: Record<string, unknown>) => void;
  emptyHint?: string;
  maxHeight?: number;
};

export default function DrilldownTable({
  rows,
  preferredOrder,
  valueLabels,
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
        const formatted = formatDisplayValue(k, v, valueLabels);
        return (
          <span
            title={formatted.title}
            style={{
              display: "inline-block",
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              verticalAlign: "top",
            }}
          >
            {formatted.display}
          </span>
        );
      },
    }));
  }, [rows, preferredOrder, valueLabels]);

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
    <div className="pulso-vv2-table-scroll" style={{ maxHeight }}>
      <table className="pulso-vv2-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const canSort = h.column.getCanSort();
                const sort = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                    style={{ cursor: canSort ? "pointer" : "default" }}
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
              className={onRowClick ? "is-clickable" : undefined}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {row.getVisibleCells().map((c) => (
                <td key={c.id}>
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

export function formatDisplayValue(
  columnKey: string,
  value: unknown,
  valueLabels?: Record<string, Record<string, string | null> | null> | null,
): { display: string; title: string } {
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const clean = raw.trim();
  if (!clean) return { display: "—", title: "" };

  const labels = lookupValueLabels(columnKey, valueLabels);
  if (!labels) return { display: raw, title: raw };

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (!tokens.length) return { display: raw, title: raw };

  const mapped = tokens.map((token) => labels[token] ?? null);
  if (!mapped.some((label) => label && label.trim())) {
    return { display: raw, title: raw };
  }

  const display = mapped
    .map((label, index) => {
      const fallback = tokens[index] ?? "";
      const cleanLabel = typeof label === "string" ? label.trim() : "";
      return cleanLabel || fallback;
    })
    .join("; ");
  const title = display === raw ? raw : `${display} (codigo original: ${raw})`;
  return { display, title };
}

function lookupValueLabels(
  columnKey: string,
  valueLabels?: Record<string, Record<string, string | null> | null> | null,
): Record<string, string | null> | null {
  if (!valueLabels) return null;
  const exact = valueLabels[columnKey];
  if (exact) return exact;
  const lowerKey = columnKey.toLowerCase();
  const match = Object.keys(valueLabels).find((key) => key.toLowerCase() === lowerKey);
  return match ? valueLabels[match] ?? null : null;
}
