import { GraficadorRef, Slide } from "../../api/client";
import { usePlanStore } from "./store";
import GraficadorSlot from "./GraficadorSlot";

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "0.75rem", fontSize: 13 }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      {children}
      {help && <span style={{ color: "#888", fontSize: 11 }}>{help}</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ padding: "4px 6px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 4 }}
    />
  );
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{ padding: "4px 6px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 4, fontFamily: "inherit" }}
    />
  );
}

function TitleEditor({ slide }: { slide: Slide }) {
  const update = usePlanStore((s) => s.updateSlidePayload);
  const p = slide.payload as Record<string, string>;
  return (
    <>
      <Field label="Título"><TextInput value={p.title ?? ""} onChange={(v) => update(slide.id, { title: v })} /></Field>
      <Field label="Subtítulo"><TextInput value={p.subtitle ?? ""} onChange={(v) => update(slide.id, { subtitle: v })} /></Field>
      <Field label="Fecha"><TextInput value={p.date ?? ""} onChange={(v) => update(slide.id, { date: v })} placeholder="Abril 2026" /></Field>
      <Field label="Línea meta (opcional)"><TextInput value={p.meta_line ?? ""} onChange={(v) => update(slide.id, { meta_line: v })} /></Field>
    </>
  );
}

function SectionEditor({ slide }: { slide: Slide }) {
  const update = usePlanStore((s) => s.updateSlidePayload);
  const p = slide.payload as Record<string, string>;
  return (
    <>
      <Field label="Título"><TextInput value={p.title ?? ""} onChange={(v) => update(slide.id, { title: v })} /></Field>
      <Field label="Subtítulo"><TextInput value={p.subtitle ?? ""} onChange={(v) => update(slide.id, { subtitle: v })} /></Field>
      <Field label="Introducción (Word)" help="Texto que aparece bajo el título al exportar a Word.">
        <TextArea value={p.intro_word ?? ""} onChange={(v) => update(slide.id, { intro_word: v })} rows={4} />
      </Field>
    </>
  );
}

function SlideConGraficosEditor({ slide, slots }: { slide: Slide; slots: string[] }) {
  const update = usePlanStore((s) => s.updateSlidePayload);
  const p = slide.payload as Record<string, string>;
  const payloadMap = slide.payload as Record<string, GraficadorRef | null | undefined>;
  return (
    <>
      <Field label="Título"><TextInput value={p.title ?? ""} onChange={(v) => update(slide.id, { title: v })} /></Field>
      <Field label="Base (nota inferior)"><TextInput value={p.base ?? ""} onChange={(v) => update(slide.id, { base: v })} placeholder="N=1631" /></Field>
      <Field label="Pie (fuente)"><TextInput value={p.footer ?? ""} onChange={(v) => update(slide.id, { footer: v })} placeholder="Fuente: Pulso PUCP" /></Field>
      {slots.map((slotName) => (
        <GraficadorSlot key={slotName} slideId={slide.id} slotName={slotName} value={payloadMap[slotName]} />
      ))}
      {(slide.tipo === "p_slide_text_l" || slide.tipo === "p_slide_text_r") && (
        <Field label="Texto adjunto"><TextArea value={p.text ?? ""} onChange={(v) => update(slide.id, { text: v })} rows={5} /></Field>
      )}
    </>
  );
}

function SlidePoblacionEditor({ slide, slots }: { slide: Slide; slots: string[] }) {
  const update = usePlanStore((s) => s.updateSlidePayload);
  const p = slide.payload as Record<string, string>;
  const payloadMap = slide.payload as Record<string, GraficadorRef | null | undefined>;
  const conCenterNote = slide.tipo === "p_slide_poblacion_2" || slide.tipo === "p_slide_poblacion_4";
  return (
    <>
      <Field label="Título"><TextInput value={p.title ?? ""} onChange={(v) => update(slide.id, { title: v })} /></Field>
      <Field label="Tag (etiqueta lateral)"><TextInput value={p.tag ?? ""} onChange={(v) => update(slide.id, { tag: v })} /></Field>
      {conCenterNote && (
        <Field label="Center note" help="Nota al centro del layout (solo en poblacion_2 y poblacion_4)."><TextInput value={p.center_note ?? ""} onChange={(v) => update(slide.id, { center_note: v })} /></Field>
      )}
      <Field label="Base"><TextInput value={p.base ?? ""} onChange={(v) => update(slide.id, { base: v })} placeholder="N=1631" /></Field>
      <Field label="Pie (footer)"><TextInput value={p.footer ?? ""} onChange={(v) => update(slide.id, { footer: v })} /></Field>
      {slots.map((slotName) => (
        <GraficadorSlot key={slotName} slideId={slide.id} slotName={slotName} value={payloadMap[slotName]} />
      ))}
    </>
  );
}

export default function SlideEditor() {
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const slide = usePlanStore((s) => s.plan.slides.find((x) => x.id === selectedSlideId));

  if (!slide) {
    return (
      <div style={{ padding: "2rem", color: "#888", fontSize: 14, flex: 1 }}>
        Selecciona o agrega un slide en el panel izquierdo.
      </div>
    );
  }

  let body: React.ReactNode;
  switch (slide.tipo) {
    case "p_slide_title":   body = <TitleEditor slide={slide} />; break;
    case "p_slide_section": body = <SectionEditor slide={slide} />; break;
    case "p_slide_1":       body = <SlideConGraficosEditor slide={slide} slots={["plot"]} />; break;
    case "p_slide_2":       body = <SlideConGraficosEditor slide={slide} slots={["left", "right"]} />; break;
    case "p_slide_text_l":  body = <SlideConGraficosEditor slide={slide} slots={["plot"]} />; break;
    case "p_slide_text_r":  body = <SlideConGraficosEditor slide={slide} slots={["plot"]} />; break;
    case "p_slide_poblacion_2": body = <SlidePoblacionEditor slide={slide} slots={["left", "right"]} />; break;
    case "p_slide_poblacion_4": body = <SlidePoblacionEditor slide={slide} slots={["up_left", "up_right", "bottom_left", "bottom_right"]} />; break;
    case "p_slide_poblacion_5": body = <SlidePoblacionEditor slide={slide} slots={["pic1", "pic2", "pic3", "pic4", "pic5"]} />; break;
    case "p_slide_poblacion_6": body = <SlidePoblacionEditor slide={slide} slots={["pic1", "pic2", "pic3", "pic4", "pic5", "pic6"]} />; break;
  }

  return (
    <div style={{ flex: 1, padding: "1.25rem 1.5rem", overflowY: "auto" }}>
      <header style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Editor: <code style={{ fontSize: 14 }}>{slide.tipo}</code></h2>
        <span style={{ fontSize: 11, color: "#888", fontFamily: "ui-monospace,monospace" }}>{slide.id}</span>
      </header>
      <div style={{ maxWidth: 600, display: "flex", flexDirection: "column" }}>{body}</div>
    </div>
  );
}
