import type { CalcMuestraOrigenTamano } from "../../../api/client";

type Props = {
  value: CalcMuestraOrigenTamano;
  onChange: (v: CalcMuestraOrigenTamano) => void;
  disponibles?: CalcMuestraOrigenTamano[];
  disabled?: boolean;
};

const OPCIONES: Record<CalcMuestraOrigenTamano, { label: string; descripcion: string }> = {
  formula: {
    label: "Fórmula estadística",
    descripcion: "Tamaño derivado de fórmula clásica con marco completo (n = N·z²·p·q·deff / …).",
  },
  meta_contractual: {
    label: "Fuera del calculador",
    descripcion: "Base, listado, muestra o meta ya cerrada. Se conserva solo por compatibilidad legacy.",
  },
  cobertura_esperada: {
    label: "Cobertura esperada",
    descripcion: "Tamaño definido como % del universo a cubrir (ej. 60% de docentes ≤250).",
  },
  matriz_perfiles_cualitativa: {
    label: "Matriz de perfiles",
    descripcion: "Cuotas por variables clave o saturación de perfiles cualitativos.",
  },
};

const TODAS: CalcMuestraOrigenTamano[] = [
  "formula", "cobertura_esperada", "matriz_perfiles_cualitativa",
];

export function OrigenTamanoSelector({ value, onChange, disponibles, disabled }: Props) {
  const base = value === "meta_contractual" ? ["meta_contractual", ...TODAS] as CalcMuestraOrigenTamano[] : TODAS;
  const opts = disponibles ?? base;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {base.map((id) => {
        const meta = OPCIONES[id];
        const habilitado = opts.includes(id) && !disabled;
        const selected = value === id;
        return (
          <label
            key={id}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: 12,
              border: selected ? "2px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
              background: selected
                ? "var(--pulso-primary-soft)"
                : habilitado
                  ? "var(--pulso-surface)"
                  : "var(--pulso-bg)",
              borderRadius: 6,
              cursor: habilitado ? "pointer" : "not-allowed",
              opacity: habilitado ? 1 : 0.5,
              transition: "border-color 160ms ease, background 160ms ease",
            }}
          >
            <input
              type="radio"
              name="origen-tamano"
              checked={selected}
              disabled={!habilitado}
              onChange={() => habilitado && onChange(id)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--pulso-primary)" }}>{meta.label}</div>
              <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 4 }}>{meta.descripcion}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
