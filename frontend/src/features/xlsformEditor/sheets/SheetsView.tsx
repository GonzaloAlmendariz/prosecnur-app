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
import { SHEET_PANEL_ID, TAB_HELP, COLUMN_HELP, isEmptyColumn, isCollapsiblePdfColumn, EXPRESSION_COLUMNS } from "./hojasModel";
import type { TabKey } from "./hojasModel";
import { SheetCell, DraftNameCell, TypeCell } from "./HojaCeldas";
import { BarraFormula, type CeldaElegida } from "./BarraFormula";
import { PanelFila } from "./PanelFila";
import type { LogicScope } from "../logic";
import type { BuilderDiagnostic, BuilderStructure } from "../types";
import "./editorXlsform.css";
import { columnaDeIdComillas, rectificarComillas } from "../parsing/comillas";

export type SheetsViewProps = {
  workbook: XlsformEditorWorkbook;
  /** Para leer en español la celda elegida (barra de fórmula). */
  scope?: LogicScope;
  /** Estructura del survey: da el nodo de la fila elegida (lectura de constraint). */
  structure?: BuilderStructure | null;
  /** Revisión del archivo (los mismos avisos del encabezado del editor). */
  diagnostics?: BuilderDiagnostic[];
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

export function SheetsView({
  workbook,
  scope,
  structure = null,
  diagnostics = [],
  onUpdateCell,
  onAddRow,
  onDeleteRow,
  onMoveRow,
  onAddColumn,
}: SheetsViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("survey");
  const [newColInput, setNewColInput] = useState("");
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);
  const [celda, setCelda] = useState<CeldaElegida | null>(null);

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

      <div className="xfx-cuerpo">
        <div className="xfx-tabla">
          <BarraFormula
            celda={celda && celda.hoja === activeTab ? celda : null}
            valor={celda && celda.hoja === activeTab ? sheet.rows[celda.fila]?.[sheet.columns.indexOf(celda.columna)] ?? "" : ""}
            nodo={celda && activeTab === "survey" ? structure?.byRow.get(celda.fila) ?? null : null}
            scope={scope}
            onCambiar={(v) => celda && onUpdateCell(activeTab, celda.fila, celda.columna, v)}
          />
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
              elegida={celda?.hoja === activeTab ? celda : null}
              onElegir={(fila, columna) => setCelda({ hoja: activeTab, fila, columna })}
            />
          </div>
        </div>
        <PanelFila
          hoja={sheet}
          celda={celda && celda.hoja === activeTab ? celda : null}
          diagnosticos={diagnostics}
          onIrAFila={(fila) => { setActiveTab("survey"); setCelda({ hoja: "survey", fila, columna: "name" }); }}
          onArreglar={(d) => {
            const columna = columnaDeIdComillas(d.id);
            const survey = workbook.survey;
            const ci = columna ? survey.columns.indexOf(columna) : -1;
            if (!columna || ci < 0 || typeof d.rowIndex !== "number") return;
            onUpdateCell("survey", d.rowIndex, columna, rectificarComillas(survey.rows[d.rowIndex]?.[ci] ?? ""));
          }}
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
  elegida: CeldaElegida | null;
  onElegir: (fila: number, columna: string) => void;
};

function SheetTable({
  sheet,
  visibleColumns,
  sheetName,
  onUpdateCell,
  onDeleteRow,
  onMoveRow,
  elegida,
  onElegir,
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
            columnaElegida={elegida?.fila === rowIndex ? elegida.columna : null}
            onElegir={(columna) => onElegir(rowIndex, columna)}
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
  columnaElegida: string | null;
  onElegir: (columna: string) => void;
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
  columnaElegida,
  onElegir,
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
          <td key={col} className={columnaElegida === col ? "is-elegida" : undefined} onFocusCapture={() => onElegir(col)}>
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


