import { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { usePlanStore } from "./store";
import { ValidationIssue, usePlanValidator } from "./usePlanValidator";

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
  const select = usePlanStore((s) => s.select);

  const total = issues.length;
  const color = errors.length > 0
    ? { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" }
    : warnings.length > 0
      ? { bg: "#fefce8", fg: "#854d0e", border: "#fde68a" }
      : { bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0" };

  const Icon = errors.length > 0 ? XCircle : warnings.length > 0 ? AlertTriangle : CheckCircle2;
  const label = errors.length > 0
    ? `${errors.length} error${errors.length === 1 ? "" : "es"}`
    : warnings.length > 0
      ? `${warnings.length} aviso${warnings.length === 1 ? "" : "s"}`
      : "Plan OK";

  function handleJumpTo(issue: ValidationIssue) {
    if (issue.slideId) {
      select(issue.slideId);
      setOpen(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={canExport ? "Validación del plan" : "El plan tiene errores que bloquean el export"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600,
          padding: "5px 10px", borderRadius: 999,
          border: `1px solid ${color.border}`,
          background: color.bg,
          color: color.fg,
          cursor: "pointer",
        }}
      >
        <Icon size={12} />
        {label}
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 20 }}
          />
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              zIndex: 21,
              minWidth: 340, maxWidth: 420,
              maxHeight: 440, overflowY: "auto",
              background: "white",
              border: "1px solid var(--pulso-border)",
              borderRadius: 8,
              boxShadow: "var(--pulso-shadow-med)",
              padding: 10,
              display: "flex", flexDirection: "column", gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>
              Salud del plan
            </div>

            {total === 0 ? (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 12, color: color.fg,
                  padding: "10px 12px", borderRadius: 6,
                  background: color.bg, border: `1px solid ${color.border}`,
                }}
              >
                <CheckCircle2 size={14} />
                <span>Todo en orden. El plan está listo para exportar.</span>
              </div>
            ) : (
              <>
                {errors.length > 0 && (
                  <IssueGroup
                    title={`Errores (${errors.length})`}
                    hint="Bloquean el export — arréglalos antes de generar el PPT/Word."
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
              </>
            )}
          </div>
        </>
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
  const palette =
    severity === "error"
      ? { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" }
      : { bg: "#fefce8", fg: "#854d0e", border: "#fde68a" };
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.4,
          color: palette.fg,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
        {hint}
      </div>
      <ul
        style={{
          listStyle: "none", padding: 0, margin: "4px 0 0",
          display: "flex", flexDirection: "column", gap: 3,
        }}
      >
        {issues.map((issue, idx) => {
          const jumpable = !!issue.slideId;
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => onJump(issue)}
                disabled={!jumpable}
                style={{
                  width: "100%", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 11, lineHeight: 1.5,
                  padding: "7px 10px", borderRadius: 6,
                  border: `1px solid ${palette.border}`,
                  background: palette.bg,
                  color: palette.fg,
                  cursor: jumpable ? "pointer" : "default",
                }}
              >
                <span style={{ flex: 1 }}>{issue.message}</span>
                {jumpable && <ChevronRight size={12} />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
