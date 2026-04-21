import { GraficadorRef, Slide, SlideType } from "../../api/client";
import { usePlanStore, SLIDE_GRAF_SLOTS, SLIDE_LABELS } from "./store";
import GraficadorSlot from "./GraficadorSlot";

// Editor transitorio — Bloque 0 del rediseño. El registry nuevo ya vive
// en graficos_metadata.R, pero el editor rico (leer metadata + renderizar
// controles por arg) se implementa en Bloque 3. Por ahora este editor
// expone los campos de texto más comunes (titulo, subtitulo, base, pie,
// etiqueta, texto) + los slots de graficador según el tipo de slide.

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

// ---- Qué campos de texto muestra cada tipo de slide -----------------------
// Mirror mínimo de los formals() reales de `prosecnur::p_slide_*`.

type TextoField = { key: string; label: string; multiline?: boolean; help?: string };

const TEXTO_FIELDS_POR_TIPO: Record<SlideType, TextoField[]> = {
  p_slide_portada: [
    { key: "titulo",    label: "Título principal" },
    { key: "subtitulo", label: "Subtítulo" },
    { key: "fecha",     label: "Fecha", help: "Ej. 'Abril 2026'." },
    { key: "subtexto",  label: "Texto descriptivo", multiline: true },
  ],
  p_slide_indice: [],
  p_slide_seccion: [
    { key: "titulo",            label: "Título de la sección" },
    { key: "subtitulo",         label: "Subtítulo" },
    { key: "introduccion_word", label: "Intro (solo Word)", multiline: true, help: "Solo aparece en export .docx." },
  ],
  p_slide_objetivo_icono: [
    { key: "titulo", label: "Título" },
    { key: "texto",  label: "Contenido", multiline: true },
    // `icono` no es campo de texto — se selecciona en el catálogo de íconos (Bloque 3).
  ],
  p_slide_texto: [
    { key: "titulo",  label: "Título" },
    { key: "texto",   label: "Párrafo",         multiline: true },
    { key: "bullets", label: "Bullets",         multiline: true, help: "Uno por línea." },
    { key: "base",    label: "Base" },
  ],
  p_slide_tabla_tecnica: [
    { key: "titulo", label: "Título" },
    { key: "filas",  label: "Filas (uno por línea, formato 'Campo: valor')", multiline: true },
    { key: "pie",    label: "Pie" },
  ],

  // 1 gráfico
  p_slide_1_grafico:               [...textosBase()],
  p_slide_1_grafico_narrativo:     [{ key: "texto", label: "Texto narrativo", multiline: true }, ...textosBase()],
  p_slide_grafico_texto_derecha:   [{ key: "texto", label: "Texto",           multiline: true }, ...textosBase()],
  p_slide_grafico_texto_izquierda: [{ key: "texto", label: "Texto",           multiline: true }, ...textosBase()],

  // 2 gráficos
  p_slide_2_graficos:                 [...textosBase()],
  p_slide_2_graficos_narrativo:       [{ key: "texto", label: "Texto narrativo", multiline: true }, ...textosBase()],
  p_slide_2_graficos_texto_izquierda: [{ key: "texto", label: "Texto", multiline: true }, ...textosBase()],
  p_slide_2_graficos_texto_derecha:   [{ key: "texto", label: "Texto", multiline: true }, ...textosBase()],

  // Grid 4
  p_slide_4_graficos: [...textosBase()],

  // Población
  p_slide_2_graficos_poblacion:   [...textosPoblacion()],
  p_slide_4_graficos_poblacion:   [...textosPoblacion()],
  p_slide_5_graficos_poblacion:   [...textosPoblacion()],
  p_slide_6_graficos_poblacion:   [...textosPoblacion()],
};

function textosBase(): TextoField[] {
  return [
    { key: "titulo",   label: "Título del slide" },
    { key: "etiqueta", label: "Etiqueta corta", help: "Texto pequeño a la izquierda del título." },
    { key: "base",     label: "Base", help: "Ej. 'Base: 120 encuestados'. Vacío = automática." },
    { key: "pie",      label: "Pie (nota)", multiline: true },
  ];
}

function textosPoblacion(): TextoField[] {
  return [
    { key: "titulo",   label: "Título del slide" },
    { key: "etiqueta", label: "Etiqueta corta" },
    { key: "base",     label: "Base" },
    { key: "pie",      label: "Pie", multiline: true },
  ];
}

// ---- Editor por slide -----------------------------------------------------

function SlideBody({ slide }: { slide: Slide }) {
  const update = usePlanStore((s) => s.updateSlidePayload);
  const p = slide.payload as Record<string, unknown>;
  const textoFields = TEXTO_FIELDS_POR_TIPO[slide.tipo] ?? [];
  const grafSlots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const payloadMap = slide.payload as Record<string, GraficadorRef | null | undefined>;

  return (
    <>
      {textoFields.map((f) => {
        const val = typeof p[f.key] === "string" ? (p[f.key] as string) : "";
        return (
          <Field key={f.key} label={f.label} help={f.help}>
            {f.multiline ? (
              <TextArea value={val} onChange={(v) => update(slide.id, { [f.key]: v })} rows={3} />
            ) : (
              <TextInput value={val} onChange={(v) => update(slide.id, { [f.key]: v })} />
            )}
          </Field>
        );
      })}

      {grafSlots.map((slotName) => (
        <GraficadorSlot
          key={slotName}
          slideId={slide.id}
          slotName={slotName}
          value={payloadMap[slotName]}
        />
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

  return (
    <div style={{ flex: 1, padding: "1.25rem 1.5rem", overflowY: "auto" }}>
      <header style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          {SLIDE_LABELS[slide.tipo] ?? slide.tipo}
          <code style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>{slide.tipo}</code>
        </h2>
        <span style={{ fontSize: 11, color: "#888", fontFamily: "ui-monospace,monospace" }}>{slide.id}</span>
      </header>
      <div style={{ maxWidth: 600, display: "flex", flexDirection: "column" }}>
        <SlideBody slide={slide} />
      </div>
    </div>
  );
}
