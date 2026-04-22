import { useMemo, useState } from "react";
import { X as XIcon } from "lucide-react";
import { Pregunta, Seccion } from "../../api/client";

// Mapa interactivo de preguntas del XLSForm agrupado por sección. Cada
// pregunta es una "ficha" con su name monospace + label + chips de
// reglas (required / relevant / constraint / calculate). Al hacer click
// se abre un panel de detalle al final.

type Filtros = {
  seccion: string;
  regla: "any" | "required" | "relevant" | "constraint" | "calculate";
  busqueda: string;
};

// Colores semánticos por regla. Usamos tokens del sistema para que
// visualmente se integre con el resto del app (warn / info / success /
// primary-soft tonal).
const RULE_COLORS: Record<string, { bg: string; fg: string; border: string; label: string; nombre: string }> = {
  required:   { bg: "var(--pulso-danger-bg)",  fg: "var(--pulso-danger-fg)",  border: "var(--pulso-danger-border)",  label: "R", nombre: "Obligatoria" },
  relevant:   { bg: "var(--pulso-info-bg)",    fg: "var(--pulso-info-fg)",    border: "var(--pulso-info-border)",    label: "V", nombre: "Visible-si (relevant)" },
  constraint: { bg: "var(--pulso-warn-bg)",    fg: "var(--pulso-warn-fg)",    border: "var(--pulso-warn-border)",    label: "C", nombre: "Restricción (constraint)" },
  calculate:  { bg: "var(--pulso-success-bg)", fg: "var(--pulso-success-fg)", border: "var(--pulso-success-border)", label: "=", nombre: "Calculada" },
};

// Hash determinístico del nombre de sección a un color pastel soft
// para que el ojo agrupe preguntas del mismo section visualmente. Usa
// HSL con saturación + lightness fijas — siempre pasteles legibles.
function sectionColor(sectionName: string): string {
  let h = 0;
  for (let i = 0; i < sectionName.length; i++) h = (h * 31 + sectionName.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 42%, 95%)`;
}

function Chip({ k }: { k: keyof typeof RULE_COLORS }) {
  const c = RULE_COLORS[k];
  return (
    <span
      title={c.nombre}
      style={{
        width: 15, height: 15, borderRadius: 3,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 700,
        background: c.bg, color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      {c.label}
    </span>
  );
}

export default function PreguntasPanel({
  preguntas, secciones,
}: {
  preguntas: Pregunta[];
  secciones: Seccion[];
}) {
  const [f, setF] = useState<Filtros>({ seccion: "", regla: "any", busqueda: "" });
  const [focus, setFocus] = useState<Pregunta | null>(null);

  const filtered = useMemo(() => {
    const q = f.busqueda.trim().toLowerCase();
    return preguntas.filter((p) => {
      if (f.seccion && p.seccion !== f.seccion) return false;
      if (f.regla !== "any" && !p[f.regla]) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.label.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [f, preguntas]);

  const bySection: Record<string, Pregunta[]> = {};
  for (const p of filtered) (bySection[p.seccion] ||= []).push(p);

  const seccionLabel = Object.fromEntries(secciones.map((s) => [s.name, s.label]));

  return (
    <div>
      {/* Leyenda de chips */}
      <div
        style={{
          display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap",
          alignItems: "center", fontSize: 11, color: "var(--pulso-text-soft)",
          padding: "8px 10px",
          background: "var(--pulso-surface-2)",
          border: "1px solid var(--pulso-border)",
          borderRadius: 7,
        }}
      >
        <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, fontSize: 10 }}>
          Leyenda
        </span>
        {(Object.keys(RULE_COLORS) as (keyof typeof RULE_COLORS)[]).map((k) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Chip k={k} /> {RULE_COLORS[k].nombre}
          </span>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={f.seccion}
          onChange={(e) => setF({ ...f, seccion: e.target.value })}
          style={{ fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--pulso-border)", background: "white" }}
        >
          <option value="">Todas las secciones</option>
          {secciones.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
        </select>
        <select
          value={f.regla}
          onChange={(e) => setF({ ...f, regla: e.target.value as Filtros["regla"] })}
          style={{ fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--pulso-border)", background: "white" }}
        >
          <option value="any">Cualquier regla</option>
          <option value="required">Solo obligatorias</option>
          <option value="relevant">Solo con relevant</option>
          <option value="constraint">Solo con constraint</option>
          <option value="calculate">Solo calculadas</option>
        </select>
        <input
          value={f.busqueda}
          onChange={(e) => setF({ ...f, busqueda: e.target.value })}
          placeholder="Buscar por nombre o etiqueta…"
          style={{
            fontSize: 13, padding: "5px 10px",
            flex: 1, minWidth: 200,
            borderRadius: 6, border: "1px solid var(--pulso-border)",
            background: "white", outline: "none",
          }}
        />
        <span
          style={{
            fontSize: 11, color: "var(--pulso-text-soft)",
            fontFamily: "ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
            padding: "3px 9px", borderRadius: 999,
            background: "var(--pulso-surface-2)",
            border: "1px solid var(--pulso-border)",
          }}
        >
          {filtered.length}/{preguntas.length}
        </span>
      </div>

      {/* Grid agrupado por sección */}
      {Object.entries(bySection).map(([sec, items]) => (
        <details key={sec} open style={{ marginBottom: 14 }}>
          <summary
            style={{
              fontSize: 12, cursor: "pointer",
              padding: "6px 10px",
              background: sectionColor(sec),
              borderRadius: 6,
              border: "1px solid var(--pulso-border)",
              listStyle: "none",
            }}
          >
            <strong style={{ color: "var(--pulso-text)" }}>{seccionLabel[sec] || sec}</strong>
            <span style={{ color: "var(--pulso-text-soft)", marginLeft: 8, fontSize: 11 }}>
              · {items.length} {items.length === 1 ? "pregunta" : "preguntas"}
            </span>
          </summary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 7, padding: "10px 0 4px",
            }}
          >
            {items.map((p) => (
              <button
                key={p.name}
                onClick={() => setFocus(p)}
                title={p.label}
                style={{
                  textAlign: "left",
                  background: sectionColor(p.seccion),
                  border: focus?.name === p.name ? "2px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
                  borderRadius: 6,
                  padding: "8px 9px",
                  cursor: "pointer",
                  fontSize: 12,
                  position: "relative",
                  minHeight: 62,
                  transition: "border-color 120ms ease, box-shadow 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (focus?.name !== p.name) {
                    e.currentTarget.style.borderColor = "var(--pulso-primary-border)";
                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,36,87,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (focus?.name !== p.name) {
                    e.currentTarget.style.borderColor = "var(--pulso-border)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, marginBottom: 3, color: "var(--pulso-text)" }}>
                  {p.name}
                </div>
                <div
                  style={{
                    color: "var(--pulso-text-soft)", fontSize: 11,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    lineHeight: 1.3,
                  }}
                >
                  {p.label.length > 32 ? p.label.slice(0, 32) + "…" : p.label}
                </div>
                <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 3 }}>
                  {p.required && <Chip k="required" />}
                  {p.relevant && <Chip k="relevant" />}
                  {p.constraint && <Chip k="constraint" />}
                  {p.calculate && <Chip k="calculate" />}
                </div>
              </button>
            ))}
          </div>
        </details>
      ))}

      {/* Panel de detalle de la pregunta enfocada */}
      {focus && (
        <div
          style={{
            marginTop: 14, padding: 14,
            border: "1px solid var(--pulso-primary-border)",
            borderRadius: 8,
            background: "var(--pulso-primary-soft)",
            boxShadow: "var(--pulso-shadow-low)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13, fontFamily: "ui-monospace, monospace", fontWeight: 700,
                  color: "var(--pulso-primary)",
                }}
              >
                {focus.name}
              </div>
              <div style={{ fontSize: 14, marginTop: 4, color: "var(--pulso-text)", fontWeight: 600, lineHeight: 1.3 }}>
                {focus.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 6, lineHeight: 1.5 }}>
                Tipo:{" "}
                <code style={{ fontFamily: "ui-monospace, monospace", color: "var(--pulso-text)" }}>
                  {focus.tipo}
                </code>
                {"  ·  "}
                Sección:{" "}
                <code style={{ fontFamily: "ui-monospace, monospace", color: "var(--pulso-text)" }}>
                  {seccionLabel[focus.seccion] || focus.seccion}
                </code>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                {focus.required && (
                  <RuleDetailChip k="required" />
                )}
                {focus.relevant && (
                  <RuleDetailChip k="relevant" />
                )}
                {focus.constraint && (
                  <RuleDetailChip k="constraint" />
                )}
                {focus.calculate && (
                  <RuleDetailChip k="calculate" />
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFocus(null)}
              className="pulso-icon"
              aria-label="Cerrar detalle"
              title="Cerrar"
            >
              <XIcon size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleDetailChip({ k }: { k: keyof typeof RULE_COLORS }) {
  const c = RULE_COLORS[k];
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 700,
        padding: "3px 9px", borderRadius: 999,
        background: c.bg, color: c.fg,
        border: `1px solid ${c.border}`,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      {c.nombre}
    </span>
  );
}
