// =============================================================================
// sheets/SheetsView.tsx — vista alternativa por hojas (Excel-like)
// =============================================================================
// Vista de "modo experto" que expone las hojas del XLSForm como tablas
// editables: `survey`, `choices`, `settings`. El usuario puede:
//   · Editar cualquier celda directamente.
//   · Agregar/eliminar filas.
//   · Agregar columnas extras (útil para campos como `label::English`,
//     `media::image`, columnas custom de filtros, etc. que la UI guiada
//     no expone).
//   · Reordenar filas (subir/bajar).
//
// Cualquier cambio se aplica con `setCell` / `insertRecord` / `deleteRow`
// directamente sobre el workbook draft. El builder visual (mismo
// workbook, otra vista) se actualiza automáticamente al re-renderizar.
//
// Esta vista es OPCIONAL — el modo Constructor sigue siendo el por
// defecto. Sirve como escape hatch cuando:
//   · Hay columnas no soportadas por la UI guiada.
//   · El usuario quiere editar muchas filas a la vez.
//   · Hay diagnostics que apuntan a celdas específicas y conviene
//     editarlas en contexto.
// =============================================================================

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Info } from "lucide-react";
import type { XlsformEditorWorkbook, XlsformEditorSheet } from "../types";

export type SheetsViewProps = {
  workbook: XlsformEditorWorkbook;
  onUpdateCell: (
    sheetName: TabKey,
    rowIndex: number,
    columnName: string,
    value: string,
  ) => void;
  onAddRow: (sheetName: TabKey) => void;
  onDeleteRow: (
    sheetName: TabKey,
    rowIndex: number,
  ) => void;
  onMoveRow: (
    sheetName: TabKey,
    rowIndex: number,
    direction: "up" | "down",
  ) => void;
  onAddColumn: (
    sheetName: TabKey,
    columnName: string,
  ) => void;
};

type TabKey = "survey" | "choices" | "settings" | "paper";

const PDF_EXTENSION_COLUMNS = new Set([
  "paper_number",
  "paper_label",
  "paper_layout",
  "paper_group",
  "paper_only",
  "paper_skip",
]);

const COLUMN_HELP: Record<string, { label: string; detail: string; badge?: string }> = {
  type: {
    label: "Tipo",
    detail: "Define qué bloque es: texto, número, selección, sección, cierre técnico, nota o cálculo.",
  },
  name: {
    label: "Código",
    detail: "Nombre interno de la variable. Se usa en lógica, cálculos, filtros y exportación.",
  },
  label: {
    label: "Texto visible",
    detail: "Pregunta o título que verá la persona encuestada.",
  },
  hint: {
    label: "Ayuda",
    detail: "Aclaración breve que acompaña la pregunta.",
  },
  required: {
    label: "Obligatoria",
    detail: "Marca si la respuesta es necesaria cuando la pregunta está visible.",
  },
  relevant: {
    label: "Lógica",
    detail: "Regla que decide cuándo aparece la pieza.",
  },
  constraint: {
    label: "Validación",
    detail: "Regla que controla si una respuesta es aceptable.",
  },
  constraint_message: {
    label: "Mensaje de validación",
    detail: "Texto humano que aparece cuando la respuesta no cumple la regla.",
  },
  calculation: {
    label: "Cálculo",
    detail: "Fórmula que produce un valor automáticamente.",
  },
  choice_filter: {
    label: "Filtro de opciones",
    detail: "Reduce las opciones de un catálogo según una respuesta previa.",
  },
  appearance: {
    label: "Presentación",
    detail: "Ajuste visual de Kobo/ODK, como minimal, search o field-list.",
  },
  list_name: {
    label: "Catálogo",
    detail: "Lista reutilizable a la que pertenece una opción.",
  },
  paper_number: {
    label: "Número impreso",
    detail: "Numeración opcional para el PDF o cuestionario en papel. No afecta Kobo.",
    badge: "PDF",
  },
  paper_label: {
    label: "Texto impreso",
    detail: "Texto alternativo para el PDF si el papel necesita una redacción distinta.",
    badge: "PDF",
  },
  paper_layout: {
    label: "Diseño impreso",
    detail: "Indicación opcional de layout para la versión PDF o papel.",
    badge: "PDF",
  },
  paper_group: {
    label: "Grupo impreso",
    detail: "Agrupa piezas en la maqueta de papel sin cambiar la lógica Kobo.",
    badge: "PDF",
  },
  paper_only: {
    label: "Solo papel",
    detail: "Marca piezas pensadas solo para la versión impresa.",
    badge: "PDF",
  },
  paper_skip: {
    label: "Omitir en papel",
    detail: "Oculta esta pieza u opción en la versión PDF, sin ocultarla en Kobo.",
    badge: "PDF",
  },
};

function isEmptyColumn(sheet: XlsformEditorSheet, columnName: string): boolean {
  const colIndex = sheet.columns.indexOf(columnName);
  if (colIndex < 0) return true;
  return sheet.rows.every((row) => !(row[colIndex] ?? "").trim());
}

function isCollapsiblePdfColumn(sheetName: TabKey, columnName: string): boolean {
  return sheetName !== "paper" && PDF_EXTENSION_COLUMNS.has(columnName);
}

export function SheetsView({
  workbook,
  onUpdateCell,
  onAddRow,
  onDeleteRow,
  onMoveRow,
  onAddColumn,
}: SheetsViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("survey");
  const [newColInput, setNewColInput] = useState("");
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);

  const sheet = workbook[activeTab] ?? { name: activeTab, columns: [], rows: [] };
  const collapsiblePdfColumns = sheet.columns.filter(
    (columnName) =>
      isCollapsiblePdfColumn(activeTab, columnName) &&
      isEmptyColumn(sheet, columnName),
  );
  const visibleColumns = showAdvancedColumns
    ? sheet.columns
    : sheet.columns.filter((columnName) => !collapsiblePdfColumns.includes(columnName));
  const hiddenPdfCount = sheet.columns.length - visibleColumns.length;

  const handleAddCol = () => {
    const trimmed = newColInput.trim();
    if (!trimmed) return;
    if (sheet.columns.includes(trimmed)) {
      // Ya existe — no duplicamos.
      setNewColInput("");
      return;
    }
    onAddColumn(activeTab, trimmed);
    setNewColInput("");
  };

  return (
    <div className="pulso-sheets-view">
      <div className="pulso-sheets-tabs" role="tablist">
        {(["survey", "choices", "settings", "paper"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            <span className="pulso-sheets-tab-name">{tab}</span>
            <span className="pulso-sheets-tab-count">
              {(workbook[tab]?.rows.length ?? 0)}
            </span>
          </button>
        ))}
      </div>

      <div className="pulso-sheets-toolbar">
        <button
          type="button"
          onClick={() => onAddRow(activeTab)}
          className="pulso-sheets-btn"
          title={`Agregar fila a ${activeTab}`}
        >
          <Plus size={13} /> Fila
        </button>
        <div className="pulso-sheets-newcol">
          <input
            type="text"
            placeholder="Nombre de columna nueva (ej. label::English)"
            value={newColInput}
            onChange={(e) => setNewColInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCol();
              }
            }}
            spellCheck={false}
          />
          <button
            type="button"
            onClick={handleAddCol}
            disabled={!newColInput.trim()}
            className="pulso-sheets-btn"
            title="Agregar columna"
          >
            <Plus size={13} /> Columna
          </button>
        </div>
        {collapsiblePdfColumns.length > 0 && (
          <button
            type="button"
            className="pulso-sheets-btn pulso-sheets-advanced-toggle"
            onClick={() => setShowAdvancedColumns((value) => !value)}
            title={showAdvancedColumns ? "Ocultar columnas PDF vacías" : "Mostrar columnas PDF vacías"}
          >
            {showAdvancedColumns ? <EyeOff size={13} /> : <Eye size={13} />}
            {showAdvancedColumns ? "Ocultar PDF vacío" : "Mostrar PDF vacío"}
          </button>
        )}
        <span className="pulso-sheets-meta">
          {visibleColumns.length}{" "}
          {visibleColumns.length === 1 ? "columna visible" : "columnas visibles"}
          {hiddenPdfCount > 0 ? ` · ${hiddenPdfCount} PDF ${hiddenPdfCount === 1 ? "oculta" : "ocultas"}` : ""} ·{" "}
          {sheet.rows.length} {sheet.rows.length === 1 ? "fila" : "filas"}
        </span>
      </div>

      {hiddenPdfCount > 0 && (
        <div className="pulso-sheets-guide" role="note">
          <Info size={15} />
          <div>
            <strong>Columnas de PDF ocultas por estar vacías</strong>
            <span>
              Sirven para la versión impresa o PDF; Kobo no las necesita. Si escribes un valor,
              la columna queda visible automáticamente.
            </span>
          </div>
        </div>
      )}

      <div className="pulso-sheets-table-wrap">
        <SheetTable
          sheet={sheet}
          visibleColumns={visibleColumns}
          sheetName={activeTab}
          onUpdateCell={onUpdateCell}
          onDeleteRow={onDeleteRow}
          onMoveRow={onMoveRow}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SheetTable — la tabla en sí. Cada celda es un input controlado.
// -----------------------------------------------------------------------------

type SheetTableProps = {
  sheet: XlsformEditorSheet;
  visibleColumns: string[];
  sheetName: TabKey;
  onUpdateCell: SheetsViewProps["onUpdateCell"];
  onDeleteRow: SheetsViewProps["onDeleteRow"];
  onMoveRow: SheetsViewProps["onMoveRow"];
};

function SheetTable({
  sheet,
  visibleColumns,
  sheetName,
  onUpdateCell,
  onDeleteRow,
  onMoveRow,
}: SheetTableProps) {
  if (sheet.columns.length === 0) {
    return (
      <div className="pulso-sheets-empty">
        Esta hoja no tiene columnas todavía. Agrega una desde la barra
        superior.
      </div>
    );
  }
  if (sheet.rows.length === 0) {
    return (
      <div className="pulso-sheets-empty">
        Hoja vacía. Agrega una fila desde la barra superior para empezar.
      </div>
    );
  }
  return (
    <table className="pulso-sheets-table">
      <thead>
        <tr>
          <th aria-label="Acciones" className="pulso-sheets-actions-col">
            #
          </th>
          {visibleColumns.map((col) => (
            <th key={col} title={col}>
              <ColumnHeader columnName={col} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, rowIndex) => (
          <SheetRow
            key={rowIndex}
            row={row}
            rowIndex={rowIndex}
            columns={visibleColumns}
            allColumns={sheet.columns}
            sheetName={sheetName}
            isFirst={rowIndex === 0}
            isLast={rowIndex === sheet.rows.length - 1}
            onUpdateCell={onUpdateCell}
            onDeleteRow={onDeleteRow}
            onMoveRow={onMoveRow}
          />
        ))}
      </tbody>
    </table>
  );
}

type SheetRowProps = {
  row: string[];
  rowIndex: number;
  columns: string[];
  allColumns: string[];
  sheetName: TabKey;
  isFirst: boolean;
  isLast: boolean;
  onUpdateCell: SheetsViewProps["onUpdateCell"];
  onDeleteRow: SheetsViewProps["onDeleteRow"];
  onMoveRow: SheetsViewProps["onMoveRow"];
};

function SheetRow({
  row,
  rowIndex,
  columns,
  allColumns,
  sheetName,
  isFirst,
  isLast,
  onUpdateCell,
  onDeleteRow,
  onMoveRow,
}: SheetRowProps) {
  return (
    <tr>
      <td className="pulso-sheets-actions-col">
        <div className="pulso-sheets-row-actions">
          <span className="pulso-sheets-row-num">{rowIndex + 1}</span>
          <div>
            <button
              type="button"
              onClick={() => onMoveRow(sheetName, rowIndex, "up")}
              disabled={isFirst}
              title="Subir fila"
              aria-label="Subir fila"
            >
              <ChevronUp size={11} />
            </button>
            <button
              type="button"
              onClick={() => onMoveRow(sheetName, rowIndex, "down")}
              disabled={isLast}
              title="Bajar fila"
              aria-label="Bajar fila"
            >
              <ChevronDown size={11} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`¿Eliminar fila ${rowIndex + 1}?`)) {
                  onDeleteRow(sheetName, rowIndex);
                }
              }}
              title="Eliminar fila"
              aria-label="Eliminar fila"
              className="pulso-sheets-btn-danger"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      </td>
      {columns.map((col) => {
        const colIdx = allColumns.indexOf(col);
        return (
          <td key={col}>
            <SheetCell
              value={colIdx >= 0 ? row[colIdx] ?? "" : ""}
              onChange={(next) => onUpdateCell(sheetName, rowIndex, col, next)}
              isExpression={EXPRESSION_COLUMNS.has(col)}
            />
          </td>
        );
      })}
    </tr>
  );
}

function ColumnHeader({ columnName }: { columnName: string }) {
  const help = COLUMN_HELP[columnName];
  if (!help) return <span>{columnName}</span>;
  return (
    <span className="pulso-sheets-column-head" title={help.detail}>
      <span>
        {help.label}
        {help.badge && <em className="pulso-sheets-column-badge">{help.badge}</em>}
      </span>
      <small>{columnName}</small>
    </span>
  );
}

/** Columnas con expresiones — usamos `font-family: monospace` para
 *  facilitar lectura de `${var}`, operadores, etc. */
const EXPRESSION_COLUMNS = new Set([
  "type",
  "relevant",
  "constraint",
  "calculation",
  "choice_filter",
  "default",
  "appearance",
  "name",
  "list_name",
  "trigger",
  "repeat_count",
]);

// -----------------------------------------------------------------------------
// SheetCell — input controlado, autosize altura para textos largos.
// -----------------------------------------------------------------------------

type SheetCellProps = {
  value: string;
  onChange: (next: string) => void;
  isExpression: boolean;
};

function SheetCell({ value, onChange, isExpression }: SheetCellProps) {
  // Autosize: usamos textarea si el valor tiene saltos de línea o es muy
  // largo (>40 chars). Sino, input simple.
  const isMultiline = value.includes("\n") || value.length > 40;
  if (isMultiline) {
    return (
      <textarea
        className={`pulso-sheets-cell ${
          isExpression ? "is-expression" : ""
        } is-multiline`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(6, Math.max(2, value.split("\n").length))}
        spellCheck={!isExpression}
      />
    );
  }
  return (
    <input
      type="text"
      className={`pulso-sheets-cell ${isExpression ? "is-expression" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={!isExpression}
    />
  );
}
