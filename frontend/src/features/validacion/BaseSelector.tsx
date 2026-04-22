import { Database, Layers } from "lucide-react";
import type { EstudioPayload } from "../../api/client";

// =============================================================================
// BaseSelector — selector de base arriba del todo en Fase 2
// =============================================================================
// Multi-base: grupo de chips tipo "tabs" con el nombre de cada base.
// Single-base (sin estudio o con 1 sola base): se oculta, no tiene sentido
// ofrecer un selector. El valor `null` significa "usa la primera base por
// defecto" y el backend lo resuelve.
//
// Cambiar de base dispara una invalidación masiva de caché en los tabs
// (vía `version` en el store) — el caller ya lo maneja.

type Props = {
  estudio: EstudioPayload | null;
  selected: string | null;
  onChange: (nombre: string) => void;
  disabled?: boolean;
};

export default function BaseSelector({ estudio, selected, onChange, disabled }: Props) {
  if (!estudio || estudio.n_bases <= 1) return null;

  const bases = Object.values(estudio.bases);

  return (
    <div
      role="tablist"
      aria-label="Base activa para validar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--pulso-surface-2)",
        border: "1px solid var(--pulso-border)",
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--pulso-text-soft)",
          paddingRight: 6,
          borderRight: "1px solid var(--pulso-border)",
          marginRight: 4,
        }}
      >
        <Layers size={12} /> Validar
      </span>
      <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
        {bases.map((b) => {
          const active = b.nombre === selected;
          return (
            <button
              key={b.nombre}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(b.nombre)}
              disabled={disabled || active}
              title={
                b.n_filas != null
                  ? `${b.nombre} · ${b.n_filas} filas · ${b.n_columnas} cols`
                  : b.nombre
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "ui-monospace, monospace",
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                background: active ? "var(--pulso-primary)" : "white",
                color: active ? "white" : "var(--pulso-text)",
                cursor: active || disabled ? "default" : "pointer",
                transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
              }}
              onMouseEnter={(e) => {
                if (active || disabled) return;
                e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
                e.currentTarget.style.background = "var(--pulso-primary-soft)";
              }}
              onMouseLeave={(e) => {
                if (active) return;
                e.currentTarget.style.borderColor = "var(--pulso-border)";
                e.currentTarget.style.background = "white";
              }}
            >
              <Database size={11} />
              {b.nombre}
              {b.n_filas != null && (
                <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>
                  · {b.n_filas}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
