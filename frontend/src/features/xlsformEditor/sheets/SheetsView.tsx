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

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import type { XlsformEditorWorkbook, XlsformEditorSheet } from "../types";
import { TechTerm } from "../helpers/TechTerm";
import { paletteForType, paletteSoftForType } from "../helpers/paletteForType";
import { iconForType } from "../helpers/icons";
import "../styles/xf-sheets.css";
import { GlidingTabList } from "../../../components/GlidingTabList";

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

const SHEET_PANEL_ID = "xlsform-sheet-panel";

const TAB_HELP: Record<TabKey, { label: string; code: string; detail: string }> = {
  survey: {
    label: "Preguntas",
    code: "survey",
    detail: "Filas del cuestionario: preguntas, notas, cálculos, secciones y lógica.",
  },
  choices: {
    label: "Opciones",
    code: "choices",
    detail: "Catálogos reutilizables para preguntas de selección.",
  },
  settings: {
    label: "Configuración",
    code: "settings",
    detail: "Título, ID, versión e idioma principal del formulario.",
  },
  paper: {
    label: "Papel/PDF",
    code: "paper",
    detail: "Ajustes opcionales de salida impresa, sin cambiar Kobo.",
  },
};

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
    label: "N° en papel",
    detail: "Numeración opcional para el PDF o cuestionario en papel. No afecta Kobo.",
    badge: "Papel",
  },
  paper_label: {
    label: "Texto en papel",
    detail: "Texto alternativo para el PDF si el papel necesita una redacción distinta.",
    badge: "Papel",
  },
  paper_layout: {
    label: "Diseño en papel",
    detail: "Indicación opcional de layout para la versión PDF o papel.",
    badge: "Papel",
  },
  paper_group: {
    label: "Grupo en papel",
    detail: "Agrupa piezas en la maqueta de papel sin cambiar la lógica Kobo.",
    badge: "Papel",
  },
  paper_only: {
    label: "Solo papel",
    detail: "Marca piezas pensadas solo para la versión impresa.",
    badge: "Papel",
  },
  paper_skip: {
    label: "Ocultar en papel",
    detail: "Oculta esta pieza u opción en la versión PDF, sin ocultarla en Kobo.",
    badge: "Papel",
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
  const pdfColumnCount = sheet.columns.filter((columnName) =>
    isCollapsiblePdfColumn(activeTab, columnName),
  ).length;
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
    <div className="pulso-xfs-view">
      <GlidingTabList className="pulso-xfs-tabs" activeKey={activeTab} role="tablist" aria-label="Hojas del XLSForm">
        {(["survey", "choices", "settings", "paper"] as TabKey[]).map((tab) => {
          const tabHelp = TAB_HELP[tab];
          return (
            <button
              key={tab}
              id={`xlsform-sheet-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={SHEET_PANEL_ID}
              data-gliding-key={tab}
              className={`pulso-xfs-tab${activeTab === tab ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab)}
              title={tabHelp.detail}
            >
              {tabHelp.label}
              <TechTerm t={tabHelp.code} title={tabHelp.detail} />
              <span className="pulso-xfs-tab-count">
                {workbook[tab]?.rows.length ?? 0}
              </span>
            </button>
          );
        })}
      </GlidingTabList>

      <div className="pulso-xfs-toolbar">
        <button
          type="button"
          onClick={() => onAddRow(activeTab)}
          className="pulso-xfs-pill pulso-xfs-pill--primary"
          title={`Agregar fila a ${TAB_HELP[activeTab].label}`}
        >
          <Plus size={13} /> Fila
        </button>
        <div className="pulso-xfs-newcol">
          <input
            type="text"
            className="pulso-xfs-newcol-input"
            placeholder="Columna nueva (ej. label::English)"
            aria-label="Nombre de la columna nueva"
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
            className="pulso-xfs-pill"
            title="Agregar columna"
          >
            <Plus size={13} /> Columna
          </button>
        </div>
        {collapsiblePdfColumns.length > 0 && (
          <button
            type="button"
            className={`pulso-xfs-pill${showAdvancedColumns ? " is-on" : ""}`}
            onClick={() => setShowAdvancedColumns((value) => !value)}
            aria-pressed={showAdvancedColumns}
            title={
              showAdvancedColumns
                ? "Ocultar columnas de papel/PDF vacías"
                : "Mostrar columnas de papel/PDF (solo afectan la versión impresa)"
            }
          >
            {showAdvancedColumns ? <EyeOff size={13} /> : <Eye size={13} />}
            Papel/PDF
          </button>
        )}
        <span className="pulso-xfs-meta">
          {visibleColumns.length}{" "}
          {visibleColumns.length === 1 ? "columna" : "columnas"} ·{" "}
          {sheet.rows.length} {sheet.rows.length === 1 ? "fila" : "filas"}
          {hiddenPdfCount > 0
            ? ` · ${hiddenPdfCount} papel/PDF ${hiddenPdfCount === 1 ? "oculta" : "ocultas"}`
            : ""}
        </span>
      </div>

      {showAdvancedColumns && pdfColumnCount > 0 && (
        <span className="pulso-xfs-hint" role="note">
          Las columnas de papel/PDF solo afectan la versión impresa; Kobo no cambia.
        </span>
      )}

      <div
        id={SHEET_PANEL_ID}
        role="tabpanel"
        aria-labelledby={`xlsform-sheet-tab-${activeTab}`}
        tabIndex={0}
        className="pulso-xfs-table-wrap"
        key={activeTab}
      >
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
      <div className="pulso-xfs-empty">Sin columnas. Agrega una arriba.</div>
    );
  }
  if (sheet.rows.length === 0) {
    return (
      <div className="pulso-xfs-empty">Hoja vacía. Agrega una fila arriba.</div>
    );
  }
  return (
    <table className="pulso-xfs-table">
      <thead>
        <tr>
          <th aria-label="Acciones" className="pulso-xfs-actions-col">
            <span className="pulso-xfs-colcode">#</span>
          </th>
          {visibleColumns.map((col) => {
            const help = COLUMN_HELP[col];
            return (
              <th
                key={col}
                title={help ? `${help.label} — ${help.detail}` : col}
              >
                <ColumnHeader columnName={col} />
              </th>
            );
          })}
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
      <td className="pulso-xfs-actions-col">
        <div className="pulso-xfs-row-actions">
          <span className="pulso-xfs-row-num">{rowIndex + 1}</span>
          <div className="pulso-xfs-row-btns">
            <button
              type="button"
              className="pulso-xfs-iconbtn"
              onClick={() => onMoveRow(sheetName, rowIndex, "up")}
              disabled={isFirst}
              title="Subir fila"
              aria-label="Subir fila"
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button"
              className="pulso-xfs-iconbtn"
              onClick={() => onMoveRow(sheetName, rowIndex, "down")}
              disabled={isLast}
              title="Bajar fila"
              aria-label="Bajar fila"
            >
              <ChevronDown size={13} />
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
              className="pulso-xfs-iconbtn pulso-xfs-iconbtn--danger"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </td>
      {columns.map((col) => {
        const colIdx = allColumns.indexOf(col);
        const value = colIdx >= 0 ? row[colIdx] ?? "" : "";
        return (
          <td key={col}>
            {col === "type" ? (
              <TypeCell
                value={value}
                onChange={(next) => onUpdateCell(sheetName, rowIndex, col, next)}
              />
            ) : sheetName === "survey" && col === "name" ? (
              // El rename de `name` propaga referencias ${old}→${new} en todo
              // el survey; se confirma en blur/Enter para no aplicar estados
              // intermedios por cada tecla (Esc revierte).
              <DraftNameCell
                value={value}
                onCommit={(next) => onUpdateCell(sheetName, rowIndex, col, next)}
              />
            ) : (
              <SheetCell
                value={value}
                onChange={(next) => onUpdateCell(sheetName, rowIndex, col, next)}
                isExpression={EXPRESSION_COLUMNS.has(col)}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}

/** Encabezado de columna: nombre técnico en mono suave; la explicación en
 *  español vive en el `title` del `<th>`. */
function ColumnHeader({ columnName }: { columnName: string }) {
  const help = COLUMN_HELP[columnName];
  return (
    <span
      className={`pulso-xfs-colhead${help?.badge ? " is-extension" : ""}`}
    >
      <span className="pulso-xfs-colcode">{columnName}</span>
      {help?.badge && <em className="pulso-xfs-col-badge">{help.badge}</em>}
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
        className={`pulso-xfs-cell ${
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
      className={`pulso-xfs-cell ${isExpression ? "is-expression" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={!isExpression}
    />
  );
}

// -----------------------------------------------------------------------------
// DraftNameCell — celda de `name` (survey) con borrador local.
// -----------------------------------------------------------------------------
// A diferencia de SheetCell, NO aplica por tecla: el commit ocurre en blur o
// Enter (Esc revierte). Aplicar un rename propaga referencias ${old}→${new}
// en todo el survey, así que hacerlo por tecleo generaba renames intermedios
// y un toast por carácter.
// -----------------------------------------------------------------------------

type DraftNameCellProps = {
  value: string;
  onCommit: (next: string) => void;
};

function DraftNameCell({ value, onCommit }: DraftNameCellProps) {
  const [draft, setDraft] = useState(value);

  // Realinea el borrador si el valor cambia desde fuera (undo, otra vista).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const dirty = draft !== value;

  function commit() {
    if (dirty) onCommit(draft);
  }

  return (
    <input
      type="text"
      className={`pulso-xfs-cell is-expression${dirty ? " is-pending" : ""}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape" && dirty) {
          e.preventDefault();
          e.stopPropagation();
          setDraft(value);
        }
      }}
      spellCheck={false}
      title="El cambio de nombre se aplica al salir de la celda o con Enter; Esc lo descarta."
    />
  );
}

// -----------------------------------------------------------------------------
// TypeCell — celda de la columna `type`: chip compacto con el color e icono
// del tipo (paletteForType / iconForType), editable en línea.
// -----------------------------------------------------------------------------

type TypeCellProps = {
  value: string;
  onChange: (next: string) => void;
};

function TypeCell({ value, onChange }: TypeCellProps) {
  const baseType = value.trim().split(/\s+/)[0] ?? "";
  const Icon = iconForType(baseType);
  const chipStyle = {
    "--xfs-type-color": paletteForType(baseType),
    "--xfs-type-bg": paletteSoftForType(baseType),
  } as CSSProperties;
  return (
    <span className="pulso-xfs-type-chip" style={chipStyle}>
      <Icon size={12} aria-hidden />
      <input
        type="text"
        className="pulso-xfs-cell is-expression"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </span>
  );
}
