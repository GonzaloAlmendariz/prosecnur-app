import { SlideType } from "../../api/client";
import { usePlanStore } from "./store";

const SLIDE_LABEL: Record<SlideType, string> = {
  p_slide_title: "Portada (título)",
  p_slide_section: "Sección (divisor)",
  p_slide_1: "1 gráfico",
  p_slide_2: "2 gráficos",
  p_slide_text_l: "Gráfico + texto (izq)",
  p_slide_text_r: "Gráfico + texto (der)",
  p_slide_poblacion_2: "Población · 2 gráficos",
  p_slide_poblacion_4: "Población · 4 gráficos",
  p_slide_poblacion_5: "Población · 5 gráficos",
  p_slide_poblacion_6: "Población · 6 gráficos",
};

const SLIDE_GROUPS: { label: string; items: SlideType[] }[] = [
  { label: "Estructurales", items: ["p_slide_title", "p_slide_section"] },
  { label: "Con gráficos", items: ["p_slide_1", "p_slide_2", "p_slide_text_l", "p_slide_text_r"] },
  { label: "Población (comparación por grupos)", items: ["p_slide_poblacion_2", "p_slide_poblacion_4", "p_slide_poblacion_5", "p_slide_poblacion_6"] },
];

export default function TimelinePanel() {
  const { plan, selectedSlideId, addSlide, removeSlide, moveSlide, select } = usePlanStore();

  return (
    <aside style={{ width: 260, borderRight: "1px solid #e3e3e8", padding: "1rem 0.75rem", overflowY: "auto" }}>
      <h3 style={{ marginTop: 0, fontSize: 14 }}>Timeline</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "1rem" }}>
        {plan.slides.length === 0 && (
          <div style={{ fontSize: 13, color: "#888", fontStyle: "italic" }}>Sin slides aún.</div>
        )}
        {plan.slides.map((s, i) => (
          <div
            key={s.id}
            onClick={() => select(s.id)}
            style={{
              padding: "0.5rem 0.6rem",
              border: selectedSlideId === s.id ? "2px solid #0066cc" : "1px solid #e3e3e8",
              borderRadius: 6,
              cursor: "pointer",
              background: selectedSlideId === s.id ? "#eff6ff" : "#fff",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#6b7280", fontFamily: "ui-monospace,monospace" }}>#{i + 1}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); moveSlide(s.id, "up"); }}
                  style={{ fontSize: 10, padding: "0 4px" }}
                  title="Subir"
                >↑</button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveSlide(s.id, "down"); }}
                  style={{ fontSize: 10, padding: "0 4px" }}
                  title="Bajar"
                >↓</button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSlide(s.id); }}
                  style={{ fontSize: 10, padding: "0 4px", color: "#c00" }}
                  title="Eliminar"
                >×</button>
              </div>
            </div>
            <div style={{ fontWeight: 600 }}>{SLIDE_LABEL[s.tipo] ?? s.tipo}</div>
            {typeof s.payload.title === "string" && s.payload.title && (
              <div style={{ color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.payload.title as string}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #e3e3e8", paddingTop: "0.5rem" }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Agregar slide</div>
        {SLIDE_GROUPS.map((g) => (
          <details key={g.label} open style={{ marginBottom: "0.5rem" }}>
            <summary style={{ fontSize: 12, cursor: "pointer", color: "#374151" }}>{g.label}</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
              {g.items.map((t) => (
                <button
                  key={t}
                  onClick={() => addSlide(t)}
                  style={{ fontSize: 12, textAlign: "left", padding: "4px 6px" }}
                >
                  + {SLIDE_LABEL[t]}
                </button>
              ))}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
