import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, X, Plus, Copy, Search } from "lucide-react";
import { SlideType } from "../../api/client";
import { usePlanStore, SLIDE_LABELS } from "./store";

// Grupos del picker "Agregar slide" — siguen la categorización humana
// del registry (`graficos_metadata.R`). El Bloque 3 los reemplazará
// por una cuadrícula visual con iconos; por ahora mantenemos
// los <details> colapsables.
const SLIDE_GROUPS: { label: string; items: SlideType[] }[] = [
  {
    label: "Estructurales",
    items: [
      "p_slide_portada",
      "p_slide_indice",
      "p_slide_seccion",
      "p_slide_objetivo_icono",
      "p_slide_texto",
      "p_slide_tabla_tecnica",
    ],
  },
  {
    label: "1 gráfico",
    items: [
      "p_slide_1_grafico",
      "p_slide_1_grafico_narrativo",
      "p_slide_grafico_texto_derecha",
      "p_slide_grafico_texto_izquierda",
    ],
  },
  {
    label: "2 gráficos",
    items: [
      "p_slide_2_graficos",
      "p_slide_2_graficos_narrativo",
      "p_slide_2_graficos_texto_izquierda",
      "p_slide_2_graficos_texto_derecha",
    ],
  },
  {
    label: "Grid 4",
    items: ["p_slide_4_graficos"],
  },
  {
    label: "Población (con ícono central)",
    items: [
      "p_slide_2_graficos_poblacion",
      "p_slide_4_graficos_poblacion",
      "p_slide_5_graficos_poblacion",
      "p_slide_6_graficos_poblacion",
    ],
  },
];

export default function TimelinePanel() {
  const { plan, selectedSlideId, addSlide, removeSlide, duplicateSlide, moveSlide, select } = usePlanStore();
  const [query, setQuery] = useState("");

  // Filtro de slides por título o tipo. Preserva el número real del
  // slide (#1, #2…) aunque haya slides ocultos por el filtro, para que
  // el analista no se desoriente con la numeración.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plan.slides.map((s, i) => ({ slide: s, index: i }));
    return plan.slides
      .map((s, i) => ({ slide: s, index: i }))
      .filter(({ slide }) => {
        const label = (SLIDE_LABELS[slide.tipo] ?? slide.tipo).toLowerCase();
        const titulo = typeof slide.payload.titulo === "string"
          ? (slide.payload.titulo as string).toLowerCase()
          : "";
        return label.includes(q) || titulo.includes(q) || slide.tipo.toLowerCase().includes(q);
      });
  }, [plan.slides, query]);

  return (
    <aside style={{ width: 260, borderRight: "1px solid var(--pulso-border)", padding: "14px 12px", overflowY: "auto", background: "var(--pulso-surface-2)" }}>
      <div className="pulso-section-eyebrow" style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Timeline</span>
        {plan.slides.length > 0 && (
          <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
            {filtered.length === plan.slides.length
              ? `${plan.slides.length} ${plan.slides.length === 1 ? "slide" : "slides"}`
              : `${filtered.length} de ${plan.slides.length}`}
          </span>
        )}
      </div>

      {plan.slides.length >= 3 && (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search
            size={12}
            color="var(--pulso-text-soft)"
            style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar slide…"
            aria-label="Buscar slide por título o tipo"
            style={{
              width: "100%", fontSize: 12,
              padding: "6px 8px 6px 26px",
              border: "1px solid var(--pulso-border)",
              borderRadius: 5, background: "white",
              outline: "none",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              style={{
                position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                width: 18, height: 18, padding: 0,
                background: "transparent", border: "none",
                color: "var(--pulso-text-soft)",
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {plan.slides.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>Sin slides aún.</div>
        )}
        {plan.slides.length > 0 && filtered.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic", padding: "10px 4px" }}>
            Ningún slide coincide con "{query}".
          </div>
        )}
        {filtered.map(({ slide: s, index: i }) => {
          const active = selectedSlideId === s.id;
          return (
            <div
              key={s.id}
              onClick={() => select(s.id)}
              style={{
                padding: "8px 10px",
                border: active ? "1px solid var(--pulso-primary)" : "1px solid var(--pulso-border)",
                borderRadius: 8,
                cursor: "pointer",
                background: active ? "rgba(0,36,87,0.04)" : "var(--pulso-surface)",
                boxShadow: active ? "0 0 0 3px rgba(0,36,87,0.12)" : "var(--pulso-shadow-low)",
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--pulso-text-soft)", fontFamily: "ui-monospace,monospace" }}>#{i + 1}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSlide(s.id, "up"); }}
                    className="pulso-icon"
                    title="Subir"
                  ><ChevronUp size={13} /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSlide(s.id, "down"); }}
                    className="pulso-icon"
                    title="Bajar"
                  ><ChevronDown size={13} /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); duplicateSlide(s.id); }}
                    className="pulso-icon"
                    title="Duplicar"
                  ><Copy size={12} /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSlide(s.id); }}
                    className="pulso-icon pulso-icon-danger"
                    title="Eliminar"
                  ><X size={13} /></button>
                </div>
              </div>
              <div style={{ fontWeight: 600, color: "var(--pulso-text)" }}>{SLIDE_LABELS[s.tipo] ?? s.tipo}</div>
              {typeof s.payload.titulo === "string" && s.payload.titulo && (
                <div style={{ color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.payload.titulo as string}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid var(--pulso-border)", paddingTop: 10 }}>
        <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Agregar slide</div>
        {SLIDE_GROUPS.map((g) => (
          <details key={g.label} open style={{ marginBottom: 8 }}>
            <summary style={{ fontSize: 11, cursor: "pointer", color: "var(--pulso-text-soft)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>{g.label}</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
              {g.items.map((t) => (
                <button
                  key={t}
                  onClick={() => addSlide(t)}
                  style={{ fontSize: 12, textAlign: "left", padding: "5px 8px", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Plus size={12} /> {SLIDE_LABELS[t]}
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
