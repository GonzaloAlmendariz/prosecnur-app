// =============================================================================
// shell/EditorCommandBar.tsx — banda de comandos del editor de formularios
// =============================================================================
// Desde L17 (D1, 2026-10-31) es la barra de mando común (`ModuleCommandBar`) y
// la excepción de chrome del ADR 0042 se retira. Las tres zonas:
//
//   [Formulario ▾] 92 preguntas · 17 secciones · 24 listas ● Guardado ↶ ↷
//                                   ▣ Constructor
//                                      ⚠ 1 aviso  [+ ▾]  [⤓ Exportar .xlsx | ▾]
//
// - contexto: selector de formulario, conteos y estado de guardado;
// - centro: el nombre de la pestaña activa del rail, que es icon-only y de
//   otro modo obliga a pasar el mouse para saber dónde se está;
// - acciones: el aviso, agregar y exportar. Son menús compuestos, así que van
//   por `herramientas` y no como acciones simples.
//
// En anchos compactos los rótulos secundarios (procedencia, «.xlsx»,
// «Deshacer») se recogen y quedan como nombre accesible y `title`; ningún
// control desaparece.
// =============================================================================

import { IconRedo, IconUndo } from "../../../lib/icons";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import type { XlsformFormPublication } from "../../../api/xlsformEditor";
import type { XlsformFormSource } from "../../../api/multiIntegrado";
import type { BuilderDiagnostic, BuilderSelection } from "../types";
import { formatSource, formatSourceLong } from "../parsing/parseType";
import { DiagnosticsBadge, type LogicaExternaCabecera } from "./DiagnosticsPopover";
import { deriveEditorHeaderStatus } from "./editorHeaderStatus";
import { formatSaveStatus, plural } from "./editorMetrics";
import { ExportMenu } from "./ExportMenu";
import { LeyendaIconos } from "./LeyendaIconos";
import { FormIntakeMenu } from "./FormIntakeMenu";
import { FormSwitcher, type FormSwitcherProps } from "./FormSwitcher";
import { PESTANAS_EDITOR, type EditorFormulariosPestanaId } from "./pestanaEditor";
import "../styles/xf-editor-chrome.css";

export type EditorCommandBarProps = {
  switcher: FormSwitcherProps;
  /** La pestaña activa del rail: su nombre se lee en el centro de la banda. */
  pestana: EditorFormulariosPestanaId;
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
    <ModuleCommandBar
      modulo="editor-xlsform"
      ariaLabel="Comandos del formulario activo"
      className="pulso-xf-cmdbar"
      contexto={(
        <>
          <FormSwitcher {...props.switcher} />
          <span
            className="pulso-xf-cmd-metrics"
            aria-label="Resumen del formulario"
            data-qa-geometry-group="xlsform/banda-metricas"
            data-qa-geometry-contract="intrinsic"
            title={`${plural(metrics.fields, "pregunta", "preguntas")} · ${plural(metrics.sections, "sección", "secciones")} · ${listsTitle}`}
          >
            <span><strong>{metrics.fields}</strong> {metrics.fields === 1 ? "pregunta" : "preguntas"}</span>
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
        </>
      )}
      secciones={<PestanaActiva pestana={props.pestana} />}
      herramientas={(
        <>
          <DiagnosticsBadge
            diagnostics={props.diagnostics}
            status={status}
            selection={props.selection}
            onSelectRow={props.onSelectRow}
            onFocusCatalog={props.onFocusCatalog}
            onReviewLogic={props.onReviewLogic}
            logicaExterna={props.logicaExterna}
          />
          <LeyendaIconos />
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
        </>
      )}
    />
  );
}

/** El nombre de la pestaña activa del rail, con su ícono y su descripción en el `title`. */
function PestanaActiva({ pestana }: { pestana: EditorFormulariosPestanaId }) {
  const activa = PESTANAS_EDITOR.find((p) => p.key === pestana);
  if (!activa) return null;
  const Icono = activa.icon;
  return (
    <span className="pulso-xf-cmd-pestana" title={activa.description} aria-live="polite">
      <Icono size={14} strokeWidth={2.2} aria-hidden="true" />
      <span>{activa.label}</span>
    </span>
  );
}
