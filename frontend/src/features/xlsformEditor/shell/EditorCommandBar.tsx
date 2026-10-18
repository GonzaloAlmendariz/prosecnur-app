// =============================================================================
// shell/EditorCommandBar.tsx — banda de comandos del editor de formularios
// =============================================================================
// Extraída de XlsformEditorPage (ola 2 del revamp). Una sola fila en todo el
// rango desktop (1024 → 1710): documento, estado y salida, con una sola acción
// con relleno (Exportar). Desde el 2026-10-15 las vistas (Constructor, Hojas,
// Mapa de lógica, Impreso…) son pestañas del rail izquierdo: el toggle
// «Constructor | Hojas» y «Más vistas» ya no viven aquí.
//
//   [Formulario ▾] 92 campos · 17 secciones · 24 listas  ● Guardado ahora ↶ ↷
//                               [Listas 3]  ⚠ Revisa la lógica
//                                          [+ Nuevo ▾]  [⤓ Exportar .xlsx | ▾]
//
// En anchos compactos los rótulos secundarios (procedencia, «Nuevo
// formulario», «.xlsx», «Deshacer») se recogen y quedan como nombre accesible
// y `title`; ningún control desaparece.
// =============================================================================

import { IconRedo, IconUndo } from "../../../lib/icons";
import { PulsoButton } from "../../../components/PulsoButton";
import { ListChecks } from "../../../vendor/lucide-react";
import type { XlsformFormPublication } from "../../../api/xlsformEditor";
import type { XlsformFormSource } from "../../../api/multiIntegrado";
import type { BuilderDiagnostic, BuilderSelection } from "../types";
import { formatSource, formatSourceLong } from "../parsing/parseType";
import { DiagnosticsBadge, type LogicaExternaCabecera } from "./DiagnosticsPopover";
import { deriveEditorHeaderStatus } from "./editorHeaderStatus";
import { formatSaveStatus, plural } from "./editorMetrics";
import { ExportMenu } from "./ExportMenu";
import { FormIntakeMenu } from "./FormIntakeMenu";
import { FormSwitcher, type FormSwitcherProps } from "./FormSwitcher";
import "../styles/xf-editor-chrome.css";

export type EditorCommandBarProps = {
  switcher: FormSwitcherProps;
  metrics: { fields: number; sections: number; catalogs: number; readyCatalogs: number };
  source: XlsformFormSource | null;
  dirty: boolean;
  lastSavedAt: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** H7: escalas repetidas y apertura del diálogo «Listas de opciones». */
  diagnostics: BuilderDiagnostic[];
  publication: XlsformFormPublication | null;
  selection: BuilderSelection | null;
  onSelectRow: (rowIndex: number) => void;
  onFocusCatalog: (name: string) => void;
  onReviewLogic?: () => void;
  /** Declarar o deshacer «la lógica y la limpieza se hicieron fuera». */
  logicaExterna?: LogicaExternaCabecera;
  canCreate: boolean;
  maxForms: number;
  onNewBlank: () => void;
  onImportXlsform: () => void;
  onImportSurveyMonkey: () => void;
  includeAppColumns: boolean;
  onIncludeAppColumnsChange: (next: boolean) => void;
  onExport: () => void;
  onOpenDocument: () => void;
  busy: boolean;
};

export function EditorCommandBar(props: EditorCommandBarProps) {
  const {
    metrics, source, dirty, lastSavedAt, canUndo, canRedo, busy,
  } = props;
  const status = deriveEditorHeaderStatus(props.diagnostics, props.publication, source);
  const saveLabel = formatSaveStatus(dirty, lastSavedAt);
  const saveTone = dirty ? "warn" : lastSavedAt != null ? "info" : "success";
  // Se cuentan las listas definidas en choices, igual que el Resumen; las referidas sin opciones van aparte (S14).
  const listsLabel = plural(metrics.readyCatalogs, "lista", "listas");
  const listasSinOpciones = metrics.catalogs - metrics.readyCatalogs;
  const listsTitle = listasSinOpciones > 0
    ? `${listsLabel} · ${plural(listasSinOpciones, "referida sin opciones", "referidas sin opciones")}`
    : listsLabel;

  return (
    <div
      className="pulso-command-bar pulso-xlsform-commandbar pulso-xf-cmdbar"
      aria-label="Comandos del formulario activo"
      data-qa-geometry-group="xlsform/banda-editor"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-xlsform-commandbar-group pulso-xlsform-commandbar-group--document">
        <FormSwitcher {...props.switcher} />
        <span
          className="pulso-xf-cmd-metrics"
          aria-label="Resumen del formulario"
          data-qa-geometry-group="xlsform/banda-metricas"
          data-qa-geometry-contract="intrinsic"
          title={`${plural(metrics.fields, "campo", "campos")} (variables que reciben respuesta) · ${plural(metrics.sections, "sección", "secciones")} · ${listsTitle}`}
        >
          <span><strong>{metrics.fields}</strong> {metrics.fields === 1 ? "campo" : "campos"}</span>
          <span aria-hidden="true">·</span>
          <span><strong>{metrics.sections}</strong> {metrics.sections === 1 ? "sección" : "secciones"}</span>
          <span className="pulso-xf-cmd-secondary" aria-hidden="true">·</span>
          <span className="pulso-xf-cmd-secondary">{listsLabel}</span>
        </span>
        <span className="pulso-xf-cmd-state" aria-label="Estado del formulario">
          <span className="pulso-xf-status is-info pulso-xf-cmd-source" title={formatSourceLong(source?.kind ?? null)}>
            <span className="pulso-xf-status-dot" aria-hidden="true" />
            <span className="pulso-xf-cmd-label pulso-xf-cmd-label--low">{formatSource(source?.kind ?? null)}</span>
          </span>
          <span className={`pulso-xf-status is-${saveTone}`} title={saveLabel}>
            <span className="pulso-xf-status-dot" aria-hidden="true" />
            <span className={dirty ? undefined : "pulso-xf-cmd-label"}>{saveLabel}</span>
          </span>
          {(canUndo || canRedo) && (
            <span className="pulso-xlsform-history-controls">
              <button
                type="button"
                onClick={props.onUndo}
                disabled={!canUndo}
                title="Deshacer (Cmd/Ctrl+Z)"
                className="pulso-xlsform-history-button"
                aria-label="Deshacer último cambio"
              >
                <IconUndo size={13} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={props.onRedo}
                disabled={!canRedo}
                title="Rehacer (Shift+Cmd/Ctrl+Z)"
                className="pulso-xlsform-history-button"
                aria-label="Rehacer cambio deshecho"
              >
                <IconRedo size={13} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </span>
          )}
        </span>
      </div>

      <div className="pulso-xlsform-commandbar-group pulso-xlsform-commandbar-group--modes">
        <DiagnosticsBadge
          diagnostics={props.diagnostics}
          status={status}
          selection={props.selection}
          onSelectRow={props.onSelectRow}
          onFocusCatalog={props.onFocusCatalog}
          onReviewLogic={props.onReviewLogic}
          logicaExterna={props.logicaExterna}
        />
      </div>

      <div className="pulso-xlsform-commandbar-group pulso-xlsform-commandbar-group--actions">
        <FormIntakeMenu
          canCreate={props.canCreate}
          maxForms={props.maxForms}
          onNewBlank={props.onNewBlank}
          onImportXlsform={props.onImportXlsform}
          onImportSurveyMonkey={props.onImportSurveyMonkey}
        />
        <ExportMenu
          includeAppColumns={props.includeAppColumns}
          onIncludeAppColumnsChange={props.onIncludeAppColumnsChange}
          onExport={props.onExport}
          onOpenDocument={props.onOpenDocument}
          disabled={busy}
        />
      </div>
    </div>
  );
}
