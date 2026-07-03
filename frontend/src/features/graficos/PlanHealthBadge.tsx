import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, CircleAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { usePlanStore } from "./store";
import { ValidationIssue, usePlanValidator } from "./usePlanValidator";

type HealthTone = "success" | "warn" | "danger";

// Badge compacto "Salud del plan" para el header. Tres estados visuales:
//   - ✔  Todo en orden (verde, pequeño): sin warnings ni errors.
//   - ⚠  N warnings (amarillo): advertencias pero export permitido.
//   - ✖  N errores (rojo): export bloqueado.
//
// Click abre un popover con lista detallada de issues. Cada issue que
// referencia un slide permite saltar a ese slide (selecciona en el store).

export function PlanHealthBadge() {
  const { errors, warnings, issues, canExport } = usePlanValidator();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const select = usePlanStore((s) => s.select);

  // Click-outside + Escape — mismo patrón que OverrideDropdown y
  // DebugPhToggle. Reemplaza el overlay fullscreen `zIndex: 20` que
  // interfería con otros popovers abiertos en el mismo header.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const total = issues.length;
  const tone: HealthTone = errors.length > 0 ? "danger" : warnings.length > 0 ? "warn" : "success";
  const Icon: LucideIcon = errors.length > 0 ? CircleAlert : warnings.length > 0 ? TriangleAlert : ShieldCheck;
  const label = errors.length > 0
    ? `${errors.length} error${errors.length === 1 ? "" : "es"}`
    : warnings.length > 0
      ? `${warnings.length} aviso${warnings.length === 1 ? "" : "s"}`
      : "OK";
  const headline = errors.length > 0
    ? "Export bloqueado"
    : warnings.length > 0
      ? "Plan con avisos"
      : "Plan listo";
  const detail = errors.length > 0
    ? "Corrige los slides señalados antes de generar PPTX o Word."
    : warnings.length > 0
      ? "El export está habilitado, pero conviene revisar estas señales."
      : "Sin errores ni avisos detectados.";
  const pillLabel = total === 0
    ? "Limpio"
    : errors.length > 0 && warnings.length > 0
      ? `${total} temas`
      : label;
  const triggerTitle = !canExport
    ? "El plan tiene errores que bloquean el export"
    : warnings.length > 0
      ? "Validación del plan: export habilitado con avisos"
      : "Validación del plan: listo para exportar";

  function handleJumpTo(issue: ValidationIssue) {
    if (issue.slideId) {
      select(issue.slideId);
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="pulso-gv2-health-root" data-state={tone} data-open={open ? "true" : "false"}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? "pulso-gv2-health-popover" : undefined}
        aria-label={`${headline}. ${detail}`}
        title={triggerTitle}
        className={`pulso-gv2-health-trigger is-${tone}`}
      >
        <Icon size={13} strokeWidth={2.2} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {open && (
        <div
          id="pulso-gv2-health-popover"
          role="dialog"
          aria-label="Salud del plan de gráficos"
          className={`pulso-gv2-health-popover is-${tone}`}
        >
          <div className="pulso-gv2-health-head">
            <span className={`pulso-gv2-health-head-mark is-${tone}`} aria-hidden="true">
              <Icon size={16} strokeWidth={2.2} />
            </span>
            <div className="pulso-gv2-health-head-copy">
              <strong>{headline}</strong>
              <span>{detail}</span>
            </div>
            <span className={`pulso-gv2-health-head-pill is-${tone}`}>
              {pillLabel}
            </span>
          </div>

          {total === 0 ? (
            <div className="pulso-gv2-health-ready">
              <div className="pulso-gv2-health-ready-copy">
                <strong>Estado base limpio</strong>
                <span>La estructura actual se mantiene sin marcas pendientes ni bloqueos.</span>
              </div>
              <span className="pulso-gv2-health-ready-seal" aria-hidden="true">
                <ShieldCheck size={16} strokeWidth={2.2} />
              </span>
            </div>
          ) : (
            <div className="pulso-gv2-health-issues">
              {errors.length > 0 && (
                <IssueGroup
                  title={`Errores (${errors.length})`}
                  hint="Bloquean el export. Abre el slide indicado y corrige el campo faltante."
                  issues={errors}
                  severity="error"
                  onJump={handleJumpTo}
                />
              )}
              {warnings.length > 0 && (
                <IssueGroup
                  title={`Avisos (${warnings.length})`}
                  hint="No bloquean el export, pero conviene revisarlos."
                  issues={warnings}
                  severity="warning"
                  onJump={handleJumpTo}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IssueGroup({
  title, hint, issues, severity, onJump,
}: {
  title: string;
  hint: string;
  issues: ValidationIssue[];
  severity: "error" | "warning";
  onJump: (issue: ValidationIssue) => void;
}) {
  return (
    <section className={`pulso-gv2-health-group is-${severity}`} aria-label={title}>
      <div className="pulso-gv2-health-group-head">
        <strong>{title}</strong>
        <span>{issues.length}</span>
      </div>
      <p>{hint}</p>
      <ul className="pulso-gv2-health-list">
        {issues.map((issue, idx) => {
          const jumpable = !!issue.slideId;
          return (
            <li key={`${issue.code}:${idx}`}>
              <button
                type="button"
                onClick={() => onJump(issue)}
                disabled={!jumpable}
                className={`pulso-gv2-health-row${jumpable ? " is-jumpable" : ""}`}
                aria-label={jumpable ? `${issue.message}. Ir al slide relacionado.` : issue.message}
              >
                <span className="pulso-gv2-health-row-marker" aria-hidden="true" />
                <span className="pulso-gv2-health-row-copy">
                  <span>{issue.message}</span>
                  <small>{jumpable ? "Abrir slide relacionado" : "Revisión global del plan"}</small>
                </span>
                {jumpable && <ChevronRight size={13} strokeWidth={2.2} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
