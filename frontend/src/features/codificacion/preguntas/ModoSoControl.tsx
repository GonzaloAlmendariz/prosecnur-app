// Pareja de opción única: qué variable recibe los códigos, la pregunta original o el texto aparte.
// Salió de `PreguntasLanding.tsx` sin cambios de regla; ahora vive en el inspector de la unidad.

import { Check } from "../../../vendor/lucide-react";
import { modoSoOptionsForDisplay, type ModoSo } from "./modeloUnidades";

export function ModoSoControl({ parent, childCol, current, busy, onChange }: {
  parent: string;
  childCol: string;
  /** El modo guardado; `null` mientras la pareja no tenga ninguno, y entonces ninguna opción va marcada. */
  current: ModoSo | null;
  busy: boolean;
  onChange: (modo: ModoSo) => void;
}) {
  const options = modoSoOptionsForDisplay(parent, childCol);
  return (
    <div
      role="group"
      aria-label={`Modo de codificación para ${parent}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 4,
        padding: 4,
        border: "1px solid var(--pulso-border)",
        borderRadius: 6,
        background: "var(--pulso-surface-2)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            title={opt.title}
            disabled={busy}
            onClick={() => onChange(opt.value)}
            style={{
              minHeight: 36,
              padding: "5px 7px",
              borderRadius: 4,
              border: `1px solid ${active ? "var(--pulso-primary)" : "transparent"}`,
              background: active ? "white" : "transparent",
              color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
              fontSize: "var(--pulso-type-caption-size)",
              fontWeight: active ? 700 : 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {active && <Check size={12} />}
            <span style={{ minWidth: 0, lineHeight: 1.15, whiteSpace: "normal", overflowWrap: "anywhere" }}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
