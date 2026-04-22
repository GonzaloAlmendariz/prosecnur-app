import { useMemo, useState } from "react";
import { Palette, X, AlertCircle } from "lucide-react";
import { usePlanStore } from "./store";

// Modal para editar presets crudos en JSON — es la "puerta de escape"
// para args de presets PPT/Word que no están expuestos en la UI curada.
// Cada sección corresponde a una clave del objeto `p_presets` (ppt) o
// `w_presets` (word) del plan. Los campos vacíos mantienen los defaults
// de prosecnur.

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

type Props = { kind: "ppt" | "word"; onClose: () => void };

export default function PresetsModal({ kind, onClose }: Props) {
  const presets = usePlanStore((s) => (kind === "ppt" ? s.presets : s.wPresets));

  function updateSection(key: string, val: Record<string, unknown>) {
    const store = usePlanStore.getState();
    if (kind === "ppt") usePlanStore.setState({ presets: { ...store.presets, [key]: val } });
    else usePlanStore.setState({ wPresets: { ...store.wPresets, [key]: val } });
  }

  const sections = useMemo(() => (kind === "ppt" ? PPT_SECTIONS : WORD_SECTIONS), [kind]);
  const titleId = `presets-modal-title-${kind}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 100%)", maxHeight: "85vh",
          background: "white", borderRadius: 10,
          boxShadow: "var(--pulso-shadow-high)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--pulso-border)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <Palette size={18} color="var(--pulso-primary)" />
          <div style={{ flex: 1 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 15 }}>
              {kind === "ppt" ? "Presets PPT (p_presets)" : "Presets Word (w_presets)"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
              Edición JSON cruda de los presets globales. Útil para args que la UI curada no expone.
              Los campos vacíos mantienen los defaults de prosecnur.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pulso-icon"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: 18, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {sections.map((sec) => (
            <details
              key={sec.key}
              style={{
                border: "1px solid var(--pulso-border)",
                borderRadius: 7,
                padding: "8px 12px",
                background: "var(--pulso-surface)",
              }}
            >
              <summary style={{ fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, listStyle: "none" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  fontFamily: "ui-monospace, monospace",
                  color: "var(--pulso-primary)",
                  padding: "2px 7px", borderRadius: 4,
                  background: "var(--pulso-primary-soft)",
                }}>
                  {sec.label}
                </span>
                <span style={{ color: "var(--pulso-text-soft)", fontSize: 11, lineHeight: 1.4 }}>
                  {sec.descripcion}
                </span>
              </summary>
              <div style={{ marginTop: 10 }}>
                <JsonEditor value={presets[sec.key] as Record<string, unknown> | undefined} onChange={(v) => updateSection(sec.key, v)} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={6}
        spellCheck={false}
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 12,
          fontFamily: "ui-monospace, monospace",
          border: `1px solid ${err ? "var(--pulso-danger-border)" : "var(--pulso-border)"}`,
          borderRadius: 5,
          background: err ? "var(--pulso-danger-bg)" : "white",
          outline: "none",
          resize: "vertical",
        }}
      />
      {err && (
        <div
          role="alert"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, fontWeight: 500,
            color: "var(--pulso-danger-fg)",
          }}
        >
          <AlertCircle size={12} />
          JSON inválido: {err}
        </div>
      )}
    </div>
  );
}
