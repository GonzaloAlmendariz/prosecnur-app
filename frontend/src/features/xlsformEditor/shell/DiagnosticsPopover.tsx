// =============================================================================
// shell/DiagnosticsPopover.tsx — badge + floater de advertencias del editor
// =============================================================================
// Reemplaza al panel "Sugerencias y advertencias" que vivía en una columna
// dentro del `BuilderToolsDeck`. Ahora es un ícono compacto con número que,
// al hacer click, despliega un popover flotante (estilo "ventana cómic") con
// la lista. Click fuera o Escape cierra.
//
// Anatomía:
//   <DiagnosticsBadge diagnostics onSelectRow onFocusCatalog />
//     ├── botón con icono + count (badge rojo si hay errores)
//     └── al click: <DiagnosticsPopover> en portal con la lista
//
// El popover se posiciona relativo al botón, anclado por debajo a la derecha.
// Si está cerca del borde derecho, se ajusta al extremo de la viewport.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { IconConditionalLogic } from "../../../lib/icons";
import type { BuilderDiagnostic, BuilderSelection } from "../types";
import type { EditorHeaderStatus } from "./editorHeaderStatus";
import { LogicaExternaDeshacer, LogicaExternaDisparador } from "./LogicaExterna";
import { CONSECUENCIA_LOGICA_EXTERNA, rotuloLogicaExterna } from "./logicaExternaModel";
import type { AccionesLogicaExterna } from "./useLogicaExterna";

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
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { tone } = status;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pulso-diagnostics-badge tone-${tone}`}
        title={status.title}
        aria-expanded={open}
        aria-haspopup="dialog"
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
      {open && triggerRef.current && (
        <DiagnosticsPopover
          anchor={triggerRef.current}
          diagnostics={diagnostics}
          status={status}
          selection={selection}
          onSelectRow={(rowIndex) => {
            onSelectRow(rowIndex);
            setOpen(false);
          }}
          onFocusCatalog={(name) => {
            onFocusCatalog(name);
            setOpen(false);
          }}
          onReviewLogic={onReviewLogic ? () => {
            setOpen(false);
            onReviewLogic();
          } : undefined}
          logicaExterna={logicaExterna ? {
            formId: logicaExterna.formId,
            // Abrir el diálogo cierra el popover: el diálogo vive en su portal.
            acciones: {
              ...logicaExterna.acciones,
              abrirPara: (id) => {
                setOpen(false);
                logicaExterna.acciones.abrirPara(id);
              },
            },
          } : undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Popover en portal
// -----------------------------------------------------------------------------

function DiagnosticsPopover({
  anchor,
  diagnostics,
  status,
  selection,
  onSelectRow,
  onFocusCatalog,
  onReviewLogic,
  logicaExterna,
  onClose,
}: {
  anchor: HTMLElement;
  diagnostics: BuilderDiagnostic[];
  status: EditorHeaderStatus;
  onReviewLogic?: () => void;
  logicaExterna?: LogicaExternaCabecera;
  selection: BuilderSelection | null;
  onSelectRow: (rowIndex: number) => void;
  onFocusCatalog: (name: string) => void;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Click fuera = cerrar. Listener en document; pone un timeout cero para
  // que el click que abrió el popover no lo cierre inmediatamente.
  useEffect(() => {
    const t = window.setTimeout(() => {
      function onDocDown(e: MouseEvent) {
        const target = e.target as Node | null;
        if (!target) return;
        if (cardRef.current?.contains(target)) return;
        if (anchor.contains(target)) return;
        onClose();
      }
      document.addEventListener("mousedown", onDocDown);
      const cleanup = () => document.removeEventListener("mousedown", onDocDown);
      // Guardamos el cleanup en el closure exterior — workaround para
      // setTimeout + useEffect cleanup.
      cleanupFn.current = cleanup;
    }, 0);
    const cleanupFn: { current: (() => void) | null } = { current: null };
    return () => {
      window.clearTimeout(t);
      if (cleanupFn.current) cleanupFn.current();
    };
  }, [anchor, onClose]);

  // Esc cierra.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Posición: por debajo del botón, alineada a la derecha (anclada al borde
  // derecho del trigger).
  const rect = anchor.getBoundingClientRect();
  const top = rect.bottom + 8;
  const right = Math.max(12, window.innerWidth - rect.right);

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

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Sugerencias y advertencias del formulario"
      className="pulso-diagnostics-popover"
      style={{ top, right }}
    >
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
          <div className="pulso-diagnostics-popover-empty">
            <CheckCircle2 size={32} color="var(--pulso-success-fg)" />
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--pulso-text-soft)" }}>
              No detectamos problemas estructurales. Buen trabajo.
            </p>
          </div>
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
    </div>,
    document.body,
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
