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
import type { BuilderDiagnostic, BuilderSelection } from "../types";

export type DiagnosticsBadgeProps = {
  diagnostics: BuilderDiagnostic[];
  selection: BuilderSelection | null;
  onSelectRow: (rowIndex: number) => void;
  onFocusCatalog: (catalogName: string) => void;
};

export function DiagnosticsBadge({
  diagnostics,
  selection,
  onSelectRow,
  onFocusCatalog,
}: DiagnosticsBadgeProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const warnCount = diagnostics.filter((d) => d.level === "warn").length;
  const infoCount = diagnostics.filter((d) => d.level === "info").length;
  const total = diagnostics.length;
  const tone: "ok" | "info" | "warn" = warnCount > 0 ? "warn" : infoCount > 0 ? "info" : "ok";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pulso-diagnostics-badge tone-${tone}`}
        title={
          tone === "ok"
            ? "Todo en orden — no hay sugerencias"
            : `${total} ${total === 1 ? "sugerencia" : "sugerencias"} (${warnCount} a revisar)`
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Sugerencias y advertencias (${total})`}
      >
        {tone === "ok" ? <CheckCircle2 size={14} /> : tone === "warn" ? <AlertTriangle size={14} /> : <Info size={14} />}
        <span className="pulso-diagnostics-badge-label">
          {tone === "ok" ? "Sin avisos" : `${total} aviso${total === 1 ? "" : "s"}`}
        </span>
      </button>
      {open && triggerRef.current && (
        <DiagnosticsPopover
          anchor={triggerRef.current}
          diagnostics={diagnostics}
          selection={selection}
          onSelectRow={(rowIndex) => {
            onSelectRow(rowIndex);
            setOpen(false);
          }}
          onFocusCatalog={(name) => {
            onFocusCatalog(name);
            setOpen(false);
          }}
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
  selection,
  onSelectRow,
  onFocusCatalog,
  onClose,
}: {
  anchor: HTMLElement;
  diagnostics: BuilderDiagnostic[];
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

  // Severidad ordering: warn > info, y dentro de cada nivel, mantenemos el
  // orden de detección para que la primera fila problemática quede arriba.
  const sorted = [...diagnostics].sort((a, b) => {
    if (a.level === b.level) return 0;
    return a.level === "warn" ? -1 : 1;
  });

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
              ? "Todo en orden por ahora."
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
        {sorted.length === 0 ? (
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
  const Icon = diag.level === "warn" ? AlertTriangle : Info;
  const color =
    diag.level === "warn" ? "var(--pulso-warn-fg)" : "var(--pulso-info-fg)";

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
