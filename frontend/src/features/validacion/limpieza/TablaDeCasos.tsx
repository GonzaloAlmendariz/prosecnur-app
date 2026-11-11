/** Casos observados de un hallazgo, con su selección. Salió de `tabs/LimpiezaTab.tsx`. */
import { LoadingBlock } from "../../../components/States";
import { type CaseRow, stringifyCellValue } from "./modeloLimpieza";
import { secondaryButtonStyle, tableCell, tableHeadCell } from "./estilosLimpieza";

// =============================================================================
// Case selection panel + helpers visuales
// =============================================================================
export function CasesTable({
  rows,
  columns,
  uuidCol,
  loading,
  error,
  selectable,
  selectionMode,
  selectedCaseIds,
  onToggle,
  onSelectAll,
  onClear,
}: {
  rows: CaseRow[];
  columns: string[];
  uuidCol: string | null;
  loading: boolean;
  error: string;
  selectable: boolean;
  selectionMode: "multiple" | "single";
  selectedCaseIds: Set<string>;
  onToggle: (caseId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  if (loading) {
    return (
      <LoadingBlock variant="inline" minHeight={40} label="Cargando casos…" />
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: "var(--pulso-type-body-size)", color: "var(--pulso-danger-fg)" }}>
        No se pudo cargar el detalle de casos: {error}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ fontSize: "var(--pulso-type-body-size)", color: "var(--pulso-text-soft)" }}>
        Sin detalle de casos disponible para esta regla.
      </div>
    );
  }

  const uuidLabel = uuidCol ?? "Caso";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {selectable && selectionMode === "multiple" && (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button type="button" onClick={onSelectAll} style={secondaryButtonStyle}>
            Seleccionar todos
          </button>
          <button type="button" onClick={onClear} style={secondaryButtonStyle}>
            Limpiar
          </button>
        </div>
      )}
      <div
        style={{
          maxHeight: 320,
          overflow: "auto",
          borderRadius: 10,
          border: "1px solid var(--pulso-border)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--pulso-type-body-size)" }}>
          <thead>
            <tr style={{ background: "var(--pulso-surface-2)" }}>
              {selectable && <th style={tableHeadCell}>{selectionMode === "single" ? "Elegir" : "Incluir"}</th>}
              <th style={tableHeadCell}>{uuidLabel}</th>
              {columns.map((column) => (
                <th key={column} style={tableHeadCell}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid var(--pulso-border)" }}>
                {selectable && (
                  <td style={tableCell}>
                    <input
                      type={selectionMode === "single" ? "radio" : "checkbox"}
                      name="limpieza-case-selection"
                      checked={selectedCaseIds.has(row.id)}
                      onChange={() => onToggle(row.id)}
                    />
                  </td>
                )}
                <td style={{ ...tableCell, fontFamily: "ui-monospace, monospace", fontSize: "var(--pulso-type-caption-size)" }}>
                  {row.id}
                </td>
                {columns.map((column) => (
                  <td key={`${row.id}-${column}`} style={tableCell}>
                    {stringifyCellValue(row.raw[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
