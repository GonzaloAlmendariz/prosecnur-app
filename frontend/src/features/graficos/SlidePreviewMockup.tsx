import { GraficadorRef, Slide } from "../../api/client";
import { safeText, safeTrimmedText } from "./safeText";
import {
  BarChart3,
  BarChartHorizontal,
  Columns3,
  PieChart,
  CircleDot,
  Hash,
  Box,
  Minus,
  Radar,
  HelpCircle,
} from "lucide-react";

function GrafIcon({ name, size = 18 }: { name: string; size?: number }) {
  const map: Record<string, typeof BarChart3> = {
    p_barras_agrupadas: BarChart3,
    p_barras_apiladas: BarChartHorizontal,
    p_barras_multiapiladas: Columns3,
    p_pie: PieChart,
    p_donut: CircleDot,
    p_numerico: Hash,
    p_boxplot: Box,
    p_media_rango: Minus,
    p_radar_tabla: Radar,
  };
  const Icon = map[name] ?? HelpCircle;
  return <Icon size={size} />;
}

function MockupChartGlyph({ name, compact = false }: { name: string; compact?: boolean }) {
  const normalized = name.toLowerCase();
  if (normalized.includes("pie") || normalized.includes("donut")) {
    return (
      <div style={{ flex: 1, minHeight: compact ? 18 : 86, display: "grid", placeItems: "center", marginTop: compact ? 2 : 8 }}>
        <span style={{
          width: compact ? 22 : 82,
          height: compact ? 22 : 82,
          borderRadius: "999px",
          background: "conic-gradient(from 40deg, rgba(0,36,87,0.78) 0 38%, rgba(13,148,136,0.72) 38% 64%, rgba(124,58,237,0.62) 64% 82%, rgba(203,113,39,0.64) 82% 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.72), 0 8px 18px rgba(15,23,42,0.10)",
        }} />
      </div>
    );
  }
  if (normalized.includes("radar")) {
    return (
      <div style={{ flex: 1, minHeight: compact ? 18 : 86, display: "grid", placeItems: "center", marginTop: compact ? 2 : 8 }}>
        <span style={{
          width: compact ? 26 : 104,
          height: compact ? 22 : 82,
          clipPath: "polygon(50% 3%, 88% 30%, 74% 88%, 28% 78%, 10% 34%)",
          background: "linear-gradient(135deg, rgba(13,148,136,0.34), rgba(0,36,87,0.42))",
          border: "1px solid rgba(0,36,87,0.24)",
          boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
        }} />
      </div>
    );
  }
  const bars = normalized.includes("apiladas")
    ? [72, 88, 62, 78]
    : [56, 78, 46, 90];
  return (
    <div style={{ flex: 1, minHeight: compact ? 18 : 86, display: "grid", alignContent: "end", gap: compact ? 2 : 6, marginTop: compact ? 2 : 8 }}>
      {bars.map((width, index) => (
        <span key={`${name}-${index}`} style={{
          display: "block",
          width: `${width}%`,
          height: compact ? 3 : 10,
          borderRadius: 999,
          background: index % 2 === 0
            ? "linear-gradient(90deg, rgba(0,36,87,0.70), rgba(13,148,136,0.54))"
            : "linear-gradient(90deg, rgba(124,58,237,0.56), rgba(203,113,39,0.50))",
          opacity: compact ? 0.82 : 0.92,
          boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset",
        }} />
      ))}
    </div>
  );
}

function SlotBox({ slot, label, compact = false }: { slot: GraficadorRef | null | undefined; label?: string; compact?: boolean }) {
  if (!slot || !slot.graficador) {
    return (
      <div style={{
        border: "1px dashed var(--pulso-border)", borderRadius: compact ? 5 : 6,
        background: "var(--pulso-surface-2)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: 0, height: "100%",
        color: "var(--pulso-text-soft)", fontSize: compact ? 8.5 : 10, padding: compact ? "0.22rem" : "0.4rem",
      }}>
        <span>sin graficador</span>
        {label && <span style={{ marginTop: compact ? 1 : 2, fontFamily: "ui-monospace,monospace" }}>{label}</span>}
      </div>
    );
  }
  const graficador = safeText(slot.graficador, "grafico");
  const varStr = safeTrimmedText(slot.args?.var, safeTrimmedText(slot.args?.vars, "-"));
  const cruces = safeTrimmedText(slot.args?.cruces, safeTrimmedText(slot.args?.cruce));
  const titulo = safeTrimmedText(slot.args?.titulo);
  return (
    <div style={{
      border: "1px solid var(--pulso-primary-border)", borderRadius: compact ? 5 : 6,
      background: "linear-gradient(135deg, rgba(0,36,87,0.10) 0%, rgba(0,36,87,0.03) 100%)",
      display: "flex", flexDirection: "column", padding: compact ? "0.28rem" : "0.4rem", gap: compact ? 1 : 2, overflow: "hidden",
      minHeight: 0, height: "100%",
      color: "var(--pulso-primary)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <GrafIcon name={graficador} size={compact ? 14 : 18} />
        {label && <span style={{ fontSize: compact ? 8 : 9, color: "var(--pulso-primary)", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginLeft: 4 }}>{label}</span>}
      </div>
      <div style={{ fontSize: compact ? 9 : 10, fontWeight: 600, fontFamily: "ui-monospace,monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {graficador.replace("p_", "")}
      </div>
      {titulo && <div style={{ fontSize: compact ? 8.5 : 10, color: "var(--pulso-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>}
      <div style={{ fontSize: compact ? 8.5 : 9, color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>var: <code>{varStr}</code></div>
      {cruces && <div style={{ fontSize: compact ? 8.5 : 9, color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>x <code>{cruces}</code></div>}
      <MockupChartGlyph name={graficador} compact={compact} />
    </div>
  );
}

function SlideFrame({ children, aspect = 16 / 9, compact = false }: { children: React.ReactNode; aspect?: number; compact?: boolean }) {
  return (
    <div style={{ width: "100%", height: compact ? "100%" : undefined, aspectRatio: compact ? undefined : String(aspect), border: "1px solid var(--pulso-border)", borderRadius: compact ? 7 : 8, background: "var(--pulso-surface)", overflow: "hidden", display: "flex", flexDirection: "column", padding: compact ? "0.34rem 0.42rem" : "0.6rem 0.75rem", boxShadow: "var(--pulso-shadow-low)" }}>
      {children}
    </div>
  );
}

function SlideTitleMockup({ slide, compact = false }: { slide: Slide; compact?: boolean }) {
  const p = slide.payload as Record<string, unknown>;
  const titulo = safeTrimmedText(p.titulo, "(sin título)");
  const subtitulo = safeTrimmedText(p.subtitulo);
  const fecha = safeTrimmedText(p.fecha);
  const subtexto = safeTrimmedText(p.subtexto);
  return (
    <SlideFrame compact={compact}>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        textAlign: "center", gap: compact ? 4 : 8, color: "#fff", margin: compact ? -7 : -10, padding: compact ? 12 : 20,
        background: "linear-gradient(135deg, var(--pulso-primary) 0%, #013371 100%)",
      }}>
        <div style={{ fontSize: compact ? 14 : 22, fontWeight: 700 }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: compact ? 10 : 14, color: "rgba(255,255,255,0.78)" }}>{subtitulo}</div>}
        {fecha && <div style={{ fontSize: compact ? 9 : 12, color: "rgba(255,255,255,0.65)", marginTop: compact ? 4 : 12 }}>{fecha}</div>}
        {subtexto && <div style={{ fontSize: compact ? 8.5 : 11, color: "rgba(255,255,255,0.6)", marginTop: compact ? 2 : 4 }}>{subtexto}</div>}
      </div>
    </SlideFrame>
  );
}

function SlideSectionMockup({ slide, compact = false }: { slide: Slide; compact?: boolean }) {
  const p = slide.payload as Record<string, unknown>;
  const titulo = safeTrimmedText(p.titulo, "(sin título)");
  const subtitulo = safeTrimmedText(p.subtitulo);
  const introduccionWord = safeTrimmedText(p.introduccion_word);
  const texto = safeTrimmedText(p.texto);
  return (
    <SlideFrame compact={compact}>
      <div style={{ flex: 1, borderLeft: `${compact ? 4 : 6}px solid var(--pulso-primary)`, padding: compact ? "0.28rem 0.42rem" : "0.5rem 0.75rem", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
        <div style={{ fontSize: compact ? 13 : 18, fontWeight: 700, color: "var(--pulso-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: compact ? 9 : 12, color: "var(--pulso-text-soft)", marginTop: compact ? 2 : 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitulo}</div>}
        {introduccionWord && <div style={{ fontSize: compact ? 8.5 : 10, color: "var(--pulso-text-soft)", marginTop: compact ? 4 : 8, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{introduccionWord}</div>}
        {texto && <div style={{ fontSize: compact ? 8.5 : 10, color: "var(--pulso-text-soft)", marginTop: compact ? 4 : 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{texto.slice(0, compact ? 48 : 90)}{texto.length > (compact ? 48 : 90) ? "…" : ""}</div>}
      </div>
    </SlideFrame>
  );
}

function HeaderFooter({ p, children, compact = false }: { p: Record<string, unknown>; children: React.ReactNode; compact?: boolean }) {
  const titulo = safeTrimmedText(p.titulo);
  const base = safeTrimmedText(p.base);
  const pie = safeTrimmedText(p.pie);
  return (
    <SlideFrame compact={compact}>
      {titulo && <div style={{ fontSize: compact ? 9.5 : 12, fontWeight: 700, color: "var(--pulso-primary)", marginBottom: compact ? 3 : 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {base && <div style={{ fontSize: compact ? 8 : 9, color: "var(--pulso-text-soft)", marginTop: compact ? 2 : 4, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{base}</div>}
      {pie && <div style={{ fontSize: compact ? 8 : 9, color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pie}</div>}
    </SlideFrame>
  );
}

function TextBlock({ texto, compact = false }: { texto: string; compact?: boolean }) {
  return (
    <div style={{ height: "100%", minHeight: 0, border: "1px dashed var(--pulso-border)", borderRadius: compact ? 5 : 6, padding: compact ? 4 : 6, fontSize: compact ? 8.5 : 10, color: "var(--pulso-text-soft)", overflow: "hidden", whiteSpace: "pre-wrap" }}>
      {texto}
    </div>
  );
}

function SlideContenidoMockup({ slide, layout, compact = false }: { slide: Slide; layout: "1" | "2" | "text_l" | "text_r" | "text_l2" | "text_r2"; compact?: boolean }) {
  const p = slide.payload as Record<string, unknown>;
  const payloadMap = slide.payload as Record<string, GraficadorRef | null | undefined>;
  const texto = safeTrimmedText(p.texto, "(texto)");
  let body: React.ReactNode;
  switch (layout) {
    case "1":
      body = <SlotBox slot={payloadMap.grafico} label="gráfico" compact={compact} />;
      break;
    case "2":
      body = <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compact ? 4 : 6, height: "100%", minHeight: 0 }}>
        <SlotBox slot={payloadMap.izquierda} label="izquierda" compact={compact} />
        <SlotBox slot={payloadMap.derecha} label="derecha" compact={compact} />
      </div>;
      break;
    case "text_l2":
      body = <div style={{ display: "grid", gridTemplateColumns: "0.78fr 1fr", gap: compact ? 4 : 6, height: "100%", minHeight: 0 }}>
        <TextBlock texto={texto} compact={compact} />
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: compact ? 4 : 6, height: "100%", minHeight: 0 }}>
          <SlotBox slot={payloadMap.grafico_1} label="gráfico 1" compact={compact} />
          <SlotBox slot={payloadMap.grafico_2} label="gráfico 2" compact={compact} />
        </div>
      </div>;
      break;
    case "text_r2":
      body = <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compact ? 4 : 6, height: "100%", minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: compact ? 4 : 6, height: "100%", minHeight: 0 }}>
          <SlotBox slot={payloadMap.grafico_1} label="gráfico 1" compact={compact} />
          <SlotBox slot={payloadMap.grafico_2} label="gráfico 2" compact={compact} />
        </div>
        <TextBlock texto={texto} compact={compact} />
      </div>;
      break;
    case "text_l":
      body = <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr", gap: compact ? 4 : 6, height: "100%", minHeight: 0 }}>
        <TextBlock texto={texto} compact={compact} />
        <SlotBox slot={payloadMap.grafico} label="gráfico" compact={compact} />
      </div>;
      break;
    case "text_r":
      body = <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr", gap: compact ? 4 : 6, height: "100%", minHeight: 0 }}>
        <SlotBox slot={payloadMap.grafico} label="gráfico" compact={compact} />
        <TextBlock texto={texto} compact={compact} />
      </div>;
      break;
  }
  return <HeaderFooter p={p} compact={compact}>{body}</HeaderFooter>;
}

function SlidePoblacionMockup({ slide, slots, layout, compact = false }: { slide: Slide; slots: string[]; layout: "row2" | "grid4" | "row5" | "row6"; compact?: boolean }) {
  const p = slide.payload as Record<string, unknown>;
  const payloadMap = slide.payload as Record<string, GraficadorRef | null | undefined>;
  const etiqueta = safeTrimmedText(p.etiqueta);
  const grid: React.CSSProperties = {
    display: "grid", gap: compact ? 4 : 6, height: "100%", minHeight: 0,
    gridTemplateColumns: layout === "row2" ? "1fr 1fr" : layout === "grid4" ? "1fr 1fr" : layout === "row5" ? "repeat(5, 1fr)" : "repeat(3, 1fr)",
    gridTemplateRows: layout === "grid4" ? "1fr 1fr" : layout === "row6" ? "1fr 1fr" : "1fr",
  };
  return (
    <HeaderFooter p={p} compact={compact}>
      {etiqueta && <div style={{ fontSize: compact ? 8.5 : 10, color: "var(--pulso-primary)", fontWeight: 600, marginBottom: compact ? 2 : 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etiqueta}</div>}
      <div style={grid}>
        {slots.map((s) => <SlotBox key={s} slot={payloadMap[s]} label={s.replace(/_/g, " ")} compact={compact} />)}
      </div>
    </HeaderFooter>
  );
}

export default function SlidePreviewMockup({ slide, compact = false }: { slide: Slide; compact?: boolean }) {
  // Mockup temporal — en el Bloque 4 se reemplaza por render PNG real
  // contra el backend (`/api/graficos/preview-slide`). Por ahora mapeamos
  // cada tipo nuevo al mockup existente más parecido.
  switch (slide.tipo) {
    // Estructurales
    case "p_slide_portada":        return <SlideTitleMockup slide={slide} compact={compact} />;
    case "p_slide_indice":         return <SlideSectionMockup slide={slide} compact={compact} />;
    case "p_slide_seccion":        return <SlideSectionMockup slide={slide} compact={compact} />;
    case "p_slide_objetivo_icono": return <SlideSectionMockup slide={slide} compact={compact} />;
    case "p_slide_texto":          return <SlideSectionMockup slide={slide} compact={compact} />;
    case "p_slide_tabla_tecnica":  return <SlideSectionMockup slide={slide} compact={compact} />;

    // 1 gráfico
    case "p_slide_1_grafico":                return <SlideContenidoMockup slide={slide} layout="1" compact={compact} />;
    case "p_slide_1_grafico_narrativo":      return <SlideContenidoMockup slide={slide} layout="1" compact={compact} />;
    case "p_slide_grafico_texto_derecha":    return <SlideContenidoMockup slide={slide} layout="text_r" compact={compact} />;
    case "p_slide_grafico_texto_izquierda":  return <SlideContenidoMockup slide={slide} layout="text_l" compact={compact} />;

    // 2 gráficos
    case "p_slide_2_graficos":                  return <SlideContenidoMockup slide={slide} layout="2" compact={compact} />;
    case "p_slide_2_graficos_narrativo":        return <SlideContenidoMockup slide={slide} layout="2" compact={compact} />;
    case "p_slide_2_graficos_texto_izquierda":  return <SlideContenidoMockup slide={slide} layout="text_l2" compact={compact} />;
    case "p_slide_2_graficos_texto_derecha":    return <SlideContenidoMockup slide={slide} layout="text_r2" compact={compact} />;

    // Grid 4
    case "p_slide_4_graficos":
      return <SlidePoblacionMockup slide={slide} slots={["superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"]} layout="grid4" compact={compact} />;

    // Población
    case "p_slide_2_graficos_poblacion":
      return <SlidePoblacionMockup slide={slide} slots={["izquierda", "derecha"]} layout="row2" compact={compact} />;
    case "p_slide_4_graficos_poblacion":
      return <SlidePoblacionMockup slide={slide} slots={["superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"]} layout="grid4" compact={compact} />;
    case "p_slide_5_graficos_poblacion":
      return <SlidePoblacionMockup slide={slide} slots={["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2"]} layout="row5" compact={compact} />;
    case "p_slide_6_graficos_poblacion":
      return <SlidePoblacionMockup slide={slide} slots={["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2", "grafico_inferior_3"]} layout="row6" compact={compact} />;

    default: return <div style={{ fontSize: 12, color: "#888" }}>Sin preview para este tipo.</div>;
  }
}
