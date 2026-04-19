import { useMemo, useState } from "react";
import { usePlanStore } from "./store";

const PPT_SECTIONS = [
  { key: "base", label: "base", descripcion: "Fuente, colores y tamaños base del reporte." },
  { key: "barras_agrupadas", label: "barras_agrupadas", descripcion: "Estilos específicos del graficador p_barras_agrupadas." },
  { key: "barras_apiladas", label: "barras_apiladas", descripcion: "Estilos de p_barras_apiladas." },
  { key: "multi_apiladas", label: "multi_apiladas", descripcion: "Estilos de p_barras_multiapiladas." },
  { key: "barras_numericas", label: "barras_numericas", descripcion: "Barras con valores numéricos." },
  { key: "numerico", label: "numerico", descripcion: "Resumen numérico (N/%/media/mediana)." },
  { key: "boxplot", label: "boxplot", descripcion: "Boxplots." },
  { key: "pie", label: "pie", descripcion: "Pie." },
  { key: "donut", label: "donut", descripcion: "Donut." },
  { key: "radar_tabla", label: "radar_tabla", descripcion: "Radar + tabla lateral." },
  { key: "debug", label: "debug", descripcion: "Flags de depuración." },
];

const WORD_SECTIONS = [
  { key: "image", label: "image", descripcion: "Dimensiones por defecto: width_in, height_in, dpi, bg." },
  { key: "title_style", label: "title_style", descripcion: "Fuente/tamaño/color del título del gráfico." },
  { key: "base_style", label: "base_style", descripcion: "Estilo de la línea de base (N)." },
  { key: "intro_style", label: "intro_style", descripcion: "Estilo del párrafo introductorio de sección." },
  { key: "subsection_style", label: "subsection_style", descripcion: "Estilo de subsecciones." },
  { key: "section_style", label: "section_style", descripcion: "Estilo de títulos de sección." },
  { key: "figure_numbering", label: "figure_numbering", descripcion: "enabled, prefix, sep (ej. Gráfico 1)." },
  { key: "toc", label: "toc", descripcion: "enabled, title del índice automático." },
];

function JsonEditor({ value, onChange }: { value: Record<string, unknown> | undefined; onChange: (v: Record<string, unknown>) => void }) {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = useState<string>("");

  function handleChange(v: string) {
    setText(v);
    try {
      const parsed = v.trim() ? JSON.parse(v) : {};
      onChange(parsed);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={5}
        style={{ width: "100%", padding: "6px 8px", fontSize: 12, fontFamily: "ui-monospace,monospace", border: "1px solid #d1d5db", borderRadius: 4 }}
      />
      {err && <div style={{ color: "#c00", fontSize: 11 }}>⚠ {err}</div>}
    </div>
  );
}

type Props = { kind: "ppt" | "word"; onClose: () => void };

export default function PresetsModal({ kind, onClose }: Props) {
  const presets = usePlanStore((s) => (kind === "ppt" ? s.presets : s.wPresets));

  function updateSection(key: string, val: Record<string, unknown>) {
    const store = usePlanStore.getState();
    if (kind === "ppt") usePlanStore.setState({ presets: { ...store.presets, [key]: val } });
    else usePlanStore.setState({ wPresets: { ...store.wPresets, [key]: val } });
  }

  const sections = useMemo(() => (kind === "ppt" ? PPT_SECTIONS : WORD_SECTIONS), [kind]);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 8, padding: "1rem 1.25rem", width: 640, maxHeight: "85vh", overflow: "auto" }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>{kind === "ppt" ? "Presets PPT (p_presets)" : "Presets Word (w_presets)"}</h3>
          <button onClick={onClose} style={{ fontSize: 12 }}>Cerrar</button>
        </header>
        <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
          Cada sección acepta un objeto JSON con los parámetros del preset correspondiente. Los campos vacíos mantienen los defaults de prosecnur.
        </p>
        {sections.map((sec) => (
          <details key={sec.key} style={{ marginBottom: "0.75rem", border: "1px solid #e3e3e8", borderRadius: 6, padding: "0.5rem 0.75rem" }}>
            <summary style={{ fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              {sec.label}{" "}
              <span style={{ color: "#888", fontWeight: 400 }}>— {sec.descripcion}</span>
            </summary>
            <div style={{ marginTop: "0.5rem" }}>
              <JsonEditor value={presets[sec.key] as Record<string, unknown> | undefined} onChange={(v) => updateSection(sec.key, v)} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
