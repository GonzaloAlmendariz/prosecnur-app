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

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Eye, EyeOff } from "lucide-react";
import type { XlsformEditorWorkbook } from "../types";
import { TechTerm } from "../helpers/TechTerm";
import "../styles/xf-sheets.css";
import { GlidingTabList } from "../../../components/GlidingTabList";
import { SHEET_PANEL_ID, TAB_HELP, isEmptyColumn, isCollapsiblePdfColumn, hojaDesdeFoco, focoDeHoja, ordenarConFijas, columnasFijas } from "./hojasModel";
import type { TabKey } from "./hojasModel";
import { TablaHoja } from "./TablaHoja";
import { BarraFormula, type CeldaElegida } from "./BarraFormula";
import { PanelFila as PanelFilaBase } from "./PanelFila";
import type { LogicScope } from "../logic";
import type { BuilderDiagnostic, BuilderStructure } from "../types";
import "./editorXlsform.css";
import { columnaDeIdComillas, rectificarComillas } from "../parsing/comillas";
import { conNivel } from "../../../lib/navegacion/direccion";
import { useDireccion } from "../../../lib/navegacion/useDireccion";

const PanelFila = memo(PanelFilaBase);

/** Devuelve la misma referencia mientras el contenido no cambie (una edición clona el workbook entero). */
function useListaEstable(lista: string[]): string[] {
  const ref = useRef(lista);
  const previa = ref.current;
  if (previa.length !== lista.length || previa.some((c, i) => c !== lista[i])) ref.current = lista;
  return ref.current;
}

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
  // La hoja activa vive en el `foco` de la dirección: recargar o compartir el enlace abre la misma hoja.
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = hojaDesdeFoco(useDireccion()?.foco ?? null);
  const [newColInput, setNewColInput] = useState("");
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);
  const [celda, setCelda] = useState<CeldaElegida | null>(null);
  /** Borrador de la celda elegida, compartido con la barra de fórmula; null si no hay cambios sin confirmar. */
  const [borrador, setBorrador] = useState<string | null>(null);
  const [irAFila, setIrAFila] = useState<number | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  const sheet = workbook[activeTab] ?? { name: activeTab, columns: [], rows: [] };
  const collapsiblePdfColumns = useMemo(
    () => sheet.columns.filter((c) => isCollapsiblePdfColumn(activeTab, c) && isEmptyColumn(sheet, c)),
    [sheet, activeTab],
  );
  const pdfColumnCount = sheet.columns.filter((columnName) =>
    isCollapsiblePdfColumn(activeTab, columnName),
  ).length;
  const visibleColumns = useListaEstable(ordenarConFijas(activeTab, showAdvancedColumns
    ? sheet.columns
    : sheet.columns.filter((columnName) => !collapsiblePdfColumns.includes(columnName))));
  const fijas = columnasFijas(activeTab, visibleColumns).length;
  const hiddenPdfCount = sheet.columns.length - visibleColumns.length;

  // Los manejadores llegan nuevos en cada render de la página: se leen por ref para que las filas memoizadas no se
  // repinten por una identidad que cambió sin cambiar nada.
  const vivo = useRef({ workbook, activeTab, celda, borrador, onUpdateCell, onDeleteRow, onMoveRow });
  vivo.current = { workbook, activeTab, celda, borrador, onUpdateCell, onDeleteRow, onMoveRow };

  const confirmar = useCallback(() => {
    const { workbook: wb, celda: c, borrador: b, onUpdateCell: guardar } = vivo.current;
    if (!c || b === null) return;
    const hoja = wb[c.hoja as TabKey];
    const guardado = hoja ? hoja.rows[c.fila]?.[hoja.columns.indexOf(c.columna)] ?? "" : "";
    vivo.current.borrador = null;
    setBorrador(null);
    if (b !== guardado) guardar(c.hoja as TabKey, c.fila, c.columna, b);
  }, []);
  const descartar = useCallback(() => { vivo.current.borrador = null; setBorrador(null); }, []);
  const elegir = useCallback((fila: number, columna: string) => {
    const { celda: c, activeTab: hoja } = vivo.current;
    if (c && c.hoja === hoja && c.fila === fila && c.columna === columna) return;
    confirmar();
    const nueva = { hoja, fila, columna };
    vivo.current.celda = nueva;
    setCelda(nueva);
  }, [confirmar]);
  const editar = useCallback((fila: number, columna: string, valor: string) => {
    elegir(fila, columna);
    vivo.current.borrador = valor;
    setBorrador(valor);
  }, [elegir]);
  const mover = useCallback((hoja: TabKey, fila: number, dir: "up" | "down") => { confirmar(); vivo.current.onMoveRow(hoja, fila, dir); }, [confirmar]);
  const eliminar = useCallback((hoja: TabKey, fila: number) => { descartar(); vivo.current.onDeleteRow(hoja, fila); }, [descartar]);
  const llegada = useCallback(() => setIrAFila(null), []);

  const setActiveTab = (hoja: TabKey) => {
    confirmar();
    navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", focoDeHoja(hoja)) }, { replace: true });
  };

  const celdaActiva = celda && celda.hoja === activeTab ? celda : null;
  const guardadoActivo = celdaActiva ? sheet.rows[celdaActiva.fila]?.[sheet.columns.indexOf(celdaActiva.columna)] ?? "" : "";

  const handleAddRow = () => {
    confirmar();
    setIrAFila(sheet.rows.length);
    onAddRow(activeTab);
  };

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
      <div className="xfx-cabecera">
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
          onClick={handleAddRow}
          className="pulso-xfs-pill pulso-xfs-pill--primary"
          title={`Agregar fila a ${TAB_HELP[activeTab].label}`}
        >
          <Plus size={13} /> Fila
        </button>
        <div className="pulso-xfs-newcol">
          <input
            type="text"
            className="pulso-xfs-newcol-input"
            placeholder="Columna nueva"
            title="Por ejemplo label::English o media::image"
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
      </div>

      {showAdvancedColumns && pdfColumnCount > 0 && (
        <span className="pulso-xfs-hint" role="note">
          Las columnas de papel/PDF solo afectan la versión impresa; el formulario digital no cambia.
        </span>
      )}

      <div className="xfx-cuerpo">
        <div className="xfx-tabla">
          <BarraFormula
            celda={celdaActiva}
            valor={celdaActiva && borrador !== null ? borrador : guardadoActivo}
            nodo={celdaActiva && activeTab === "survey" ? structure?.byRow.get(celdaActiva.fila) ?? null : null}
            scope={scope}
            pendiente={borrador !== null && borrador !== guardadoActivo}
            onCambiar={(v) => celdaActiva && editar(celdaActiva.fila, celdaActiva.columna, v)}
            onConfirmar={confirmar}
            onDescartar={descartar}
          />
          <div
            id={SHEET_PANEL_ID}
            role="tabpanel"
            aria-labelledby={`xlsform-sheet-tab-${activeTab}`}
            tabIndex={0}
            className="pulso-xfs-table-wrap"
            key={activeTab}
            ref={contenedor}
          >
            {sheet.columns.length === 0 ? (
              <div className="pulso-xfs-empty">Sin columnas. Agrega una arriba.</div>
            ) : sheet.rows.length === 0 ? (
              <div className="pulso-xfs-empty">Hoja vacía. Agrega una fila arriba.</div>
            ) : (
              <TablaHoja
                hoja={sheet}
                hojaClave={activeTab}
                columnas={visibleColumns}
                fijas={fijas}
                contenedor={contenedor}
                elegida={celdaActiva}
                borrador={celdaActiva ? borrador : null}
                onElegir={elegir}
                onEditar={editar}
                onConfirmar={confirmar}
                onDescartar={descartar}
                onMoveRow={mover}
                onDeleteRow={eliminar}
                irAFila={irAFila}
                onLlegada={llegada}
              />
            )}
          </div>
        </div>
        <PanelFila
          hoja={sheet}
          celda={celdaActiva}
          diagnosticos={diagnostics}
          onIrAFila={(fila) => { setActiveTab("survey"); setCelda({ hoja: "survey", fila, columna: "name" }); setIrAFila(fila); }}
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
