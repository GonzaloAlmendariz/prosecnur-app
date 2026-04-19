import { useMemo, useState } from "react";
import { Pregunta, Seccion } from "../../api/client";

type Filtros = {
  seccion: string;
  regla: "any" | "required" | "relevant" | "constraint" | "calculate";
  busqueda: string;
};

const RULE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  required:   { bg: "#fecaca", fg: "#991b1b", label: "R" },
  relevant:   { bg: "#bae6fd", fg: "#075985", label: "V" },
  constraint: { bg: "#fed7aa", fg: "#9a3412", label: "C" },
  calculate:  { bg: "#ddd6fe", fg: "#4c1d95", label: "=" },
};

function sectionColor(sectionName: string): string {
  let h = 0;
  for (let i = 0; i < sectionName.length; i++) h = (h * 31 + sectionName.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 40%, 92%)`;
}

function Chip({ k }: { k: keyof typeof RULE_COLORS }) {
  const c = RULE_COLORS[k];
  return (
    <span
      title={k}
      style={{
        width: 14, height: 14, borderRadius: 3, display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 700,
        background: c.bg, color: c.fg,
      }}
    >
      {c.label}
    </span>
  );
}

export default function PreguntasPanel({ preguntas, secciones }: { preguntas: Pregunta[]; secciones: Seccion[] }) {
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
    <div style={{ marginTop: "0.5rem" }}>
      <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
        Cada celda es una pregunta; los chips en la esquina señalan qué reglas ya están declaradas en el XLSForm
        (<Chip k="required" /> obligatoria, <Chip k="relevant" /> visible-si, <Chip k="constraint" /> restricción,
        <Chip k="calculate" /> calculada). El color indica la sección. Pasa el mouse para ver la etiqueta completa,
        click para ver detalle abajo.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={f.seccion} onChange={(e) => setF({ ...f, seccion: e.target.value })} style={{ fontSize: 13 }}>
          <option value="">Todas las secciones</option>
          {secciones.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
        </select>
        <select value={f.regla} onChange={(e) => setF({ ...f, regla: e.target.value as Filtros["regla"] })} style={{ fontSize: 13 }}>
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
          style={{ fontSize: 13, padding: "2px 6px", flex: 1, minWidth: 180 }}
        />
        <span style={{ fontSize: 12, color: "#888" }}>{filtered.length} / {preguntas.length}</span>
      </div>

      {Object.entries(bySection).map(([sec, items]) => (
        <details key={sec} open style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 13, cursor: "pointer", padding: "4px 8px", background: sectionColor(sec), borderRadius: 4 }}>
            <strong>{seccionLabel[sec] || sec}</strong>
            <span style={{ color: "#666", marginLeft: 8 }}>· {items.length}</span>
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6, padding: "8px 0" }}>
            {items.map((p) => (
              <button
                key={p.name}
                onClick={() => setFocus(p)}
                title={p.label}
                style={{
                  textAlign: "left",
                  background: sectionColor(p.seccion),
                  border: focus?.name === p.name ? "2px solid #0066cc" : "1px solid #e3e3e8",
                  borderRadius: 6,
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: 12,
                  position: "relative",
                  minHeight: 56,
                }}
              >
                <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                <div style={{ color: "#555", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.label.length > 28 ? p.label.slice(0, 28) + "…" : p.label}
                </div>
                <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 2 }}>
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

      {focus && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e3e3e8", borderRadius: 6, background: "#fafafa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <div style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{focus.name}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{focus.label}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Tipo: <code>{focus.tipo}</code> · Sección: <code>{seccionLabel[focus.seccion] || focus.seccion}</code>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {focus.required && <Chip k="required" />}
                {focus.relevant && <Chip k="relevant" />}
                {focus.constraint && <Chip k="constraint" />}
                {focus.calculate && <Chip k="calculate" />}
              </div>
            </div>
            <button onClick={() => setFocus(null)} style={{ fontSize: 12 }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
