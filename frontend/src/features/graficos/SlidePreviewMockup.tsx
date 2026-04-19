import { GraficadorRef, Slide } from "../../api/client";
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

function SlotBox({ slot, label }: { slot: GraficadorRef | null | undefined; label?: string }) {
  if (!slot || !slot.graficador) {
    return (
      <div style={{
        border: "1px dashed var(--pulso-border)", borderRadius: 6,
        background: "var(--pulso-surface-2)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "var(--pulso-text-soft)", fontSize: 10, padding: "0.4rem",
      }}>
        <span>sin graficador</span>
        {label && <span style={{ marginTop: 2, fontFamily: "ui-monospace,monospace" }}>{label}</span>}
      </div>
    );
  }
  const varStr = (slot.args?.var as string) ?? (Array.isArray(slot.args?.vars) ? `[${(slot.args!.vars as string[]).join(", ")}]` : "—");
  const cruces = (slot.args?.cruces as string) ?? (slot.args?.cruce as string) ?? "";
  const titulo = (slot.args?.titulo as string) ?? "";
  return (
    <div style={{
      border: "1px solid var(--pulso-primary-border)", borderRadius: 6,
      background: "linear-gradient(135deg, rgba(0,36,87,0.10) 0%, rgba(0,36,87,0.03) 100%)",
      display: "flex", flexDirection: "column", padding: "0.4rem", gap: 2, overflow: "hidden",
      color: "var(--pulso-primary)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <GrafIcon name={slot.graficador} size={18} />
        {label && <span style={{ fontSize: 9, color: "var(--pulso-primary)", fontFamily: "ui-monospace,monospace" }}>{label}</span>}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, fontFamily: "ui-monospace,monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {slot.graficador.replace("p_", "")}
      </div>
      {titulo && <div style={{ fontSize: 10, color: "var(--pulso-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>}
      <div style={{ fontSize: 9, color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>var: <code>{varStr}</code></div>
      {cruces && <div style={{ fontSize: 9, color: "var(--pulso-text-soft)" }}>× <code>{cruces}</code></div>}
    </div>
  );
}

function SlideFrame({ children, aspect = 16 / 9 }: { children: React.ReactNode; aspect?: number }) {
  return (
    <div style={{ width: "100%", aspectRatio: String(aspect), border: "1px solid var(--pulso-border)", borderRadius: 8, background: "var(--pulso-surface)", overflow: "hidden", display: "flex", flexDirection: "column", padding: "0.6rem 0.75rem", boxShadow: "var(--pulso-shadow-low)" }}>
      {children}
    </div>
  );
}

function SlideTitleMockup({ slide }: { slide: Slide }) {
  const p = slide.payload as Record<string, string>;
  return (
    <SlideFrame>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        textAlign: "center", gap: 8, color: "#fff", margin: -10, padding: 20,
        background: "linear-gradient(135deg, var(--pulso-primary) 0%, #013371 100%)",
      }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{p.title || "(sin título)"}</div>
        {p.subtitle && <div style={{ fontSize: 14, color: "rgba(255,255,255,0.78)" }}>{p.subtitle}</div>}
        {p.date && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 12 }}>{p.date}</div>}
        {p.meta_line && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{p.meta_line}</div>}
      </div>
    </SlideFrame>
  );
}

function SlideSectionMockup({ slide }: { slide: Slide }) {
  const p = slide.payload as Record<string, string>;
  return (
    <SlideFrame>
      <div style={{ flex: 1, borderLeft: "6px solid var(--pulso-primary)", padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--pulso-primary)" }}>{p.title || "(sin título)"}</div>
        {p.subtitle && <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 4 }}>{p.subtitle}</div>}
        {p.intro_word && <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", marginTop: 8, fontStyle: "italic" }}>{p.intro_word}</div>}
      </div>
    </SlideFrame>
  );
}

function HeaderFooter({ p, children }: { p: Record<string, string>; children: React.ReactNode }) {
  return (
    <SlideFrame>
      {p.title && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-primary)", marginBottom: 6 }}>{p.title}</div>}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {p.base && <div style={{ fontSize: 9, color: "var(--pulso-text-soft)", marginTop: 4, fontStyle: "italic" }}>{p.base}</div>}
      {p.footer && <div style={{ fontSize: 9, color: "var(--pulso-text-soft)" }}>{p.footer}</div>}
    </SlideFrame>
  );
}

function SlideContenidoMockup({ slide, layout }: { slide: Slide; layout: "1" | "2" | "text_l" | "text_r" }) {
  const p = slide.payload as Record<string, string>;
  const payloadMap = slide.payload as Record<string, GraficadorRef | null | undefined>;
  let body: React.ReactNode;
  switch (layout) {
    case "1":
      body = <SlotBox slot={payloadMap.plot} label="plot" />;
      break;
    case "2":
      body = <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, height: "100%" }}>
        <SlotBox slot={payloadMap.left} label="left" />
        <SlotBox slot={payloadMap.right} label="right" />
      </div>;
      break;
    case "text_l":
      body = <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr", gap: 6, height: "100%" }}>
        <div style={{ border: "1px dashed var(--pulso-border)", borderRadius: 6, padding: 6, fontSize: 10, color: "var(--pulso-text-soft)", overflow: "hidden", whiteSpace: "pre-wrap" }}>
          {p.text || "(texto)"}
        </div>
        <SlotBox slot={payloadMap.plot} label="plot" />
      </div>;
      break;
    case "text_r":
      body = <div style={{ display: "grid", gridTemplateColumns: "1fr 0.8fr", gap: 6, height: "100%" }}>
        <SlotBox slot={payloadMap.plot} label="plot" />
        <div style={{ border: "1px dashed var(--pulso-border)", borderRadius: 6, padding: 6, fontSize: 10, color: "var(--pulso-text-soft)", overflow: "hidden", whiteSpace: "pre-wrap" }}>
          {p.text || "(texto)"}
        </div>
      </div>;
      break;
  }
  return <HeaderFooter p={p}>{body}</HeaderFooter>;
}

function SlidePoblacionMockup({ slide, slots, layout }: { slide: Slide; slots: string[]; layout: "row2" | "grid4" | "row5" | "row6" }) {
  const p = slide.payload as Record<string, string>;
  const payloadMap = slide.payload as Record<string, GraficadorRef | null | undefined>;
  const grid: React.CSSProperties = {
    display: "grid", gap: 6, height: "100%",
    gridTemplateColumns: layout === "row2" ? "1fr 1fr" : layout === "grid4" ? "1fr 1fr" : layout === "row5" ? "repeat(5, 1fr)" : "repeat(3, 1fr)",
    gridTemplateRows: layout === "grid4" ? "1fr 1fr" : layout === "row6" ? "1fr 1fr" : "1fr",
  };
  return (
    <HeaderFooter p={p}>
      {p.tag && <div style={{ fontSize: 10, color: "var(--pulso-primary)", fontWeight: 600, marginBottom: 4 }}>{p.tag}</div>}
      <div style={grid}>
        {slots.map((s) => <SlotBox key={s} slot={payloadMap[s]} label={s} />)}
      </div>
      {(p.center_note) && <div style={{ fontSize: 10, color: "var(--pulso-primary)", textAlign: "center", marginTop: 4 }}>{p.center_note}</div>}
    </HeaderFooter>
  );
}

export default function SlidePreviewMockup({ slide }: { slide: Slide }) {
  switch (slide.tipo) {
    case "p_slide_title":   return <SlideTitleMockup slide={slide} />;
    case "p_slide_section": return <SlideSectionMockup slide={slide} />;
    case "p_slide_1":       return <SlideContenidoMockup slide={slide} layout="1" />;
    case "p_slide_2":       return <SlideContenidoMockup slide={slide} layout="2" />;
    case "p_slide_text_l":  return <SlideContenidoMockup slide={slide} layout="text_l" />;
    case "p_slide_text_r":  return <SlideContenidoMockup slide={slide} layout="text_r" />;
    case "p_slide_poblacion_2": return <SlidePoblacionMockup slide={slide} slots={["left", "right"]} layout="row2" />;
    case "p_slide_poblacion_4": return <SlidePoblacionMockup slide={slide} slots={["up_left", "up_right", "bottom_left", "bottom_right"]} layout="grid4" />;
    case "p_slide_poblacion_5": return <SlidePoblacionMockup slide={slide} slots={["pic1", "pic2", "pic3", "pic4", "pic5"]} layout="row5" />;
    case "p_slide_poblacion_6": return <SlidePoblacionMockup slide={slide} slots={["pic1", "pic2", "pic3", "pic4", "pic5", "pic6"]} layout="row6" />;
    default: return <div style={{ fontSize: 12, color: "#888" }}>Sin preview para este tipo.</div>;
  }
}
