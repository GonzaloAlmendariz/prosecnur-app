// =============================================================================
// shell/DiagnosticsPopover.tsx — badge + floater de advertencias del editor
// =============================================================================
// Un ícono compacto con el estado del formulario que, al hacer click, abre la
// lista de sugerencias y advertencias en el Popover del kit (L1): portal,
// posición con clamping al viewport, Escape y click fuera vienen de él.
//
// Anatomía:
//   <DiagnosticsBadge diagnostics onSelectRow onFocusCatalog />
//     ├── botón con icono + count (badge rojo si hay errores)
//     └── al click: <Popover> con <DiagnosticsContenido>
//
// El Popover del kit no es controlado: elegir una fila, revisar la lógica o
// abrir el diálogo de lógica externa lo cierran subiendo `cierres`.
// =============================================================================

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "../../../vendor/lucide-react";
import { Popover } from "../../../components/Popover";
import { IconConditionalLogic } from "../../../lib/icons";
import type { BuilderDiagnostic, BuilderSelection } from "../types";
import type { EditorHeaderStatus } from "./editorHeaderStatus";
import { LogicaExternaDeshacer, LogicaExternaDisparador } from "./LogicaExterna";
import { CONSECUENCIA_LOGICA_EXTERNA, rotuloLogicaExterna } from "./logicaExternaModel";
import type { AccionesLogicaExterna } from "./useLogicaExterna";
import { EstadoVacio } from "../../../components/EstadoVacio";

/** Formulario abierto y acciones para declarar/deshacer la lógica hecha fuera. */
export type LogicaExternaCabecera = { formId: string; acciones: AccionesLogicaExterna };

export type DiagnosticsBadgeProps = {
  diagnostics: BuilderDiagnostic[];
  /** Estado unificado (diagnósticos + publicación). Una sola fuente (U10). */
  status: EditorHeaderStatus;
  selection: BuilderSelection | null;
  onSelectRow: (rowIndex: number) => void;
  onFocusCatalog: (catalogName: string) => void;
  /** Abre la revisión de la lógica cuando ése es el paso pendiente. */
  onReviewLogic?: () => void;
  logicaExterna?: LogicaExternaCabecera;
};

export function DiagnosticsBadge({
  diagnostics,
  status,
  selection,
  onSelectRow,
  onFocusCatalog,
  onReviewLogic,
  logicaExterna,
}: DiagnosticsBadgeProps) {
  const [cierres, setCierres] = useState(0);
  const cerrar = () => setCierres((n) => n + 1);
  const { tone } = status;

  return (
    <Popover
      align="end"
      maxWidth={420}
      className="pulso-diagnostics-panel"
      ariaLabel="Sugerencias y advertencias del formulario"
      cerrarAlCambiar={cierres}
      trigger={(
        <button
          type="button"
          className={`pulso-diagnostics-badge tone-${tone}`}
          title={status.title}
          aria-label={`Estado del formulario: ${status.label}`}
        >
          {tone === "neutral"
            ? <IconConditionalLogic size={14} />
            : tone === "ok"
            ? <CheckCircle2 size={14} />
            : tone === "info"
              ? <Info size={14} />
              : status.logicStepPending && tone === "warn"
                ? <IconConditionalLogic size={14} />
                : <AlertTriangle size={14} />}
          <span className="pulso-diagnostics-badge-label">{status.label}</span>
        </button>
      )}
    >
      <DiagnosticsContenido
        diagnostics={diagnostics}
        status={status}
        selection={selection}
        onSelectRow={(rowIndex) => {
          onSelectRow(rowIndex);
          cerrar();
        }}
        onFocusCatalog={(name) => {
          onFocusCatalog(name);
          cerrar();
        }}
        onReviewLogic={onReviewLogic ? () => {
          cerrar();
          onReviewLogic();
        } : undefined}
        logicaExterna={logicaExterna ? {
          formId: logicaExterna.formId,
          // Abrir el diálogo cierra el popover: el diálogo vive en su portal.
          acciones: {
            ...logicaExterna.acciones,
            abrirPara: (id) => {
              cerrar();
              logicaExterna.acciones.abrirPara(id);
            },
          },
        } : undefined}
        onClose={cerrar}
      />
    </Popover>
  );
}

// -----------------------------------------------------------------------------
// Contenido del popover
// -----------------------------------------------------------------------------

function DiagnosticsContenido({
  diagnostics,
  status,
  selection,
  onSelectRow,
  onFocusCatalog,
  onReviewLogic,
  logicaExterna,
  onClose,
}: {
  diagnostics: BuilderDiagnostic[];
  status: EditorHeaderStatus;
  onReviewLogic?: () => void;
  logicaExterna?: LogicaExternaCabecera;
  selection: BuilderSelection | null;
  onSelectRow: (rowIndex: number) => void;
  onFocusCatalog: (name: string) => void;
  onClose: () => void;
}) {
  // Severidad ordering: error > warn > info, y dentro de cada nivel,
  // mantenemos el orden de detección para que la primera fila problemática
  // quede arriba. Lo que bloquea la publicación va primero siempre.
  const rank = (level: BuilderDiagnostic["level"]) =>
    level === "error" ? 0 : level === "warn" ? 1 : 2;
  // Las correcciones que exige el backend se listan junto a los diagnósticos:
  // si la cabecera las cuenta, el popover tiene que poder mostrarlas.
  const remote: BuilderDiagnostic[] = status.publicationErrors.map((b) => ({
    id: b.id,
    level: "error",
    title: b.title,
    detail: b.detail,
    rowIndex: b.rowIndex,
  }));
  const sorted = [...remote, ...diagnostics].sort((a, b) => rank(a.level) - rank(b.level));
  const blockingCount = sorted.filter((d) => d.level === "error").length;

  return (
    <>
      <header className="pulso-diagnostics-popover-header">
        <div>
          <strong style={{ fontSize: 13 }}>Sugerencias y advertencias</strong>
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2 }}>
            {sorted.length === 0
              ? status.logicStepPending
                ? "Falta un paso para publicar."
                : status.logicaExterna
                  ? "La lógica y la limpieza se hicieron fuera de Prosecnur."
                  : "Todo en orden por ahora."
              : blockingCount > 0
                ? `${blockingCount} ${blockingCount === 1 ? "impide" : "impiden"} publicar una revisión.`
                : `${sorted.length} ${sorted.length === 1 ? "punto" : "puntos"} por revisar antes de exportar.`}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="pulso-icon"
          aria-label="Cerrar avisos"
          title="Cerrar"
        >
          <X size={14} />
        </button>
      </header>

      <div className="pulso-diagnostics-popover-list">
        {status.logicStepPending && (
          <div className="pulso-diagnostics-popover-item pulso-diagnostics-popover-step">
            <span className="pulso-diagnostics-popover-icon" style={{ color: "var(--pulso-warn-fg)" }}>
              <IconConditionalLogic size={14} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ fontSize: 12, color: "var(--pulso-text)" }}>Confirma la lógica</strong>
              <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45, marginTop: 2 }}>
                Es el paso que falta para publicar una revisión del instrumento.
              </div>
              <div className="pulso-diagnostics-popover-logica-externa-acciones">
                {onReviewLogic && (
                  <button type="button" className="pulso-primary pulso-diagnostics-popover-action" onClick={onReviewLogic}>
                    Revisar lógica
                  </button>
                )}
                {logicaExterna && (
                  <LogicaExternaDisparador formId={logicaExterna.formId} acciones={logicaExterna.acciones} />
                )}
              </div>
            </div>
          </div>
        )}
        {status.logicaExterna && (
          <div className="pulso-diagnostics-popover-item pulso-diagnostics-popover-logica-externa">
            <strong style={{ fontSize: 12, color: "var(--pulso-text)" }}>
              {rotuloLogicaExterna(status.logicaExterna)}
            </strong>
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.45 }}>
              {CONSECUENCIA_LOGICA_EXTERNA}
            </span>
            {status.logicaExterna.nota ? (
              <span style={{ fontSize: 11, color: "var(--pulso-text-faint)", lineHeight: 1.45 }}>
                Nota: {status.logicaExterna.nota}
              </span>
            ) : null}
            {logicaExterna && (
              <LogicaExternaDeshacer formId={logicaExterna.formId} acciones={logicaExterna.acciones} />
            )}
          </div>
        )}
        {sorted.length === 0 && !status.logicStepPending && !status.logicaExterna ? (
          <EstadoVacio
            tamano="normal"
            icono={<CheckCircle2 size={20} />}
            titulo="Sin problemas estructurales"
            descripcion="El validador no encontró nada que corregir."
          />
        ) : (
          sorted.map((diag) => (
            <DiagnosticItem
              key={diag.id}
              diag={diag}
              selection={selection}
              onSelectRow={onSelectRow}
              onFocusCatalog={onFocusCatalog}
            />
          ))
        )}
      </div>
    </>
  );
}

function DiagnosticItem({
  diag,
  selection,
  onSelectRow,
  onFocusCatalog,
}: {
  diag: BuilderDiagnostic;
  selection: BuilderSelection | null;
  onSelectRow: (rowIndex: number) => void;
  onFocusCatalog: (name: string) => void;
}) {
  const isActiveRow =
    diag.rowIndex != null &&
    selection?.kind === "survey" &&
    selection.rowIndex === diag.rowIndex;
  const Icon = diag.level === "info" ? Info : AlertTriangle;
  const color =
    diag.level === "error"
      ? "var(--pulso-danger-fg)"
      : diag.level === "warn"
        ? "var(--pulso-warn-fg)"
        : "var(--pulso-info-fg)";

  function go() {
    if (diag.rowIndex != null) onSelectRow(diag.rowIndex);
    else if (diag.catalogName) onFocusCatalog(diag.catalogName);
  }

  const clickable = diag.rowIndex != null || !!diag.catalogName;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? go : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          go();
        }
      }}
      className={`pulso-diagnostics-popover-item${isActiveRow ? " is-active" : ""}${clickable ? " is-clickable" : ""}`}
    >
      <span className="pulso-diagnostics-popover-icon" style={{ color }}>
        <Icon size={14} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <strong style={{ fontSize: 12, color: "var(--pulso-text)" }}>{diag.title}</strong>
        <div
          style={{
            fontSize: 11,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.45,
            marginTop: 2,
          }}
        >
          {diag.detail}
        </div>
      </div>
    </div>
  );
}
