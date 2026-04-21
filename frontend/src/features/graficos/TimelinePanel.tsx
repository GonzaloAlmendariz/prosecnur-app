import { ChevronUp, ChevronDown, X, Plus } from "lucide-react";
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
  const { plan, selectedSlideId, addSlide, removeSlide, moveSlide, select } = usePlanStore();

  return (
    <aside style={{ width: 260, borderRight: "1px solid var(--pulso-border)", padding: "14px 12px", overflowY: "auto", background: "var(--pulso-surface-2)" }}>
      <div className="pulso-section-eyebrow" style={{ marginBottom: 8 }}>Timeline</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {plan.slides.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>Sin slides aún.</div>
        )}
        {plan.slides.map((s, i) => {
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
