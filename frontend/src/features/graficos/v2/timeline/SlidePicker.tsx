import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Columns3,
  Eye,
  FilePlus2,
  Grid3X3,
  Layers3,
  LayoutGrid,
  LayoutPanelTop,
  Plus,
  Search,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { SlideType } from "../../../../api/client";
import { usePlanStore, SLIDE_LABELS } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { SlideTypeIcon } from "../../SlideTypeIcon";
import { categoryOf, CATEGORY_LABEL, SlideCategory } from "./categoryOf";

// SlidePicker — popup elegante para añadir slides.
// Trigger: botón "+ Agregar slide" en el timeline.
// Contenido: grilla de tiles con ícono + nombre, agrupados por categoría
// con tabs internas. Búsqueda al inicio. Esc para cerrar; click outside
// también. Animación de fade-in-up al abrir.

const ALL_TYPES: SlideType[] = [
  "p_slide_portada",
  "p_slide_indice",
  "p_slide_seccion",
  "p_slide_objetivo_icono",
  "p_slide_texto",
  "p_slide_tabla_tecnica",
  "p_slide_1_grafico",
  "p_slide_1_grafico_narrativo",
  "p_slide_grafico_texto_derecha",
  "p_slide_grafico_texto_izquierda",
  "p_slide_2_graficos",
  "p_slide_2_graficos_narrativo",
  "p_slide_2_graficos_texto_izquierda",
  "p_slide_2_graficos_texto_derecha",
  "p_slide_4_graficos",
  "p_slide_2_graficos_poblacion",
  "p_slide_4_graficos_poblacion",
  "p_slide_5_graficos_poblacion",
  "p_slide_6_graficos_poblacion",
];

const ORDER: ("all" | SlideCategory)[] = ["all", "estructural", "1g", "2g", "grid", "poblacion"];
type BlueprintPattern = "cover" | "single" | "narrative" | "split" | "grid" | "population";
type PreviewScale = "card" | "hero";
type SlidePreviewLayout =
  | "cover"
  | "index"
  | "section"
  | "objective"
  | "text"
  | "technical"
  | "single"
  | "singleNarrative"
  | "splitRight"
  | "splitLeft"
  | "two"
  | "twoNarrative"
  | "twoTextLeft"
  | "twoTextRight"
  | "grid4"
  | "population2"
  | "population4"
  | "population5"
  | "population6";

const CAT_LABEL_WITH_ALL: Record<"all" | SlideCategory, string> = {
  all: "Todos",
  ...CATEGORY_LABEL,
};

const CAT_META: Record<"all" | SlideCategory, { Icon: LucideIcon; hint: string }> = {
  all: { Icon: LayoutGrid, hint: "Biblioteca" },
  estructural: { Icon: LayoutPanelTop, hint: "Portada y texto" },
  "1g": { Icon: BarChart3, hint: "Visual único" },
  "2g": { Icon: Columns3, hint: "Comparación" },
  grid: { Icon: Grid3X3, hint: "Matriz" },
  poblacion: { Icon: UsersRound, hint: "Perfiles" },
};

export type SlidePickerProps = {
  open: boolean;
  onClose: () => void;
};

export function SlidePicker({ open, onClose }: SlidePickerProps) {
  const addSlide = usePlanStore((s) => s.addSlide);
  const { slidesById } = useGraficosRegistry();
  const [filter, setFilter] = useState<"all" | SlideCategory>("all");
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<SlideType>(ALL_TYPES[0]);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Auto-focus búsqueda al abrir + reset estado al cerrar
  useEffect(() => {
    if (open) {
      setQuery("");
      setFilter("all");
      setSelectedType(ALL_TYPES[0]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Esc + click outside para cerrar
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_TYPES.filter((t) => {
      if (filter !== "all" && categoryOf(t) !== filter) return false;
      if (!q) return true;
      const label = (SLIDE_LABELS[t] ?? t).toLowerCase();
      const desc = (slidesById[t]?.descripcion ?? "").toLowerCase();
      return label.includes(q) || desc.includes(q) || t.toLowerCase().includes(q);
    });
  }, [filter, query, slidesById]);

  useEffect(() => {
    if (!open || filtered.length === 0 || filtered.includes(selectedType)) return;
    setSelectedType(filtered[0]);
  }, [filtered, open, selectedType]);

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(ORDER.map((c) => [c, 0])) as Record<"all" | SlideCategory, number>;
    counts.all = ALL_TYPES.length;
    for (const type of ALL_TYPES) counts[categoryOf(type)] += 1;
    return counts;
  }, []);

  const activeMeta = CAT_META[filter];
  const activeLabel = CAT_LABEL_WITH_ALL[filter];
  const selectedMeta = slidesById[selectedType];
  const selectedCategory = categoryOf(selectedType);
  const selectedPattern = blueprintPattern(selectedType);
  const selectedSlots = selectedMeta?.slots ?? [];
  const selectedSlotCount = inferredSlotCount(selectedType) || selectedSlots.length;
  const selectedSlotItems = selectedSlotCount > 0
    ? Array.from({ length: selectedSlotCount }, (_, index) => `Slot ${index + 1}`)
    : [];

  function insertSlide(type: SlideType) {
    addSlide(type);
    onClose();
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="pulso-gv2-picker-backdrop" role="dialog" aria-modal="true" aria-label="Insertar modelo de slide">
      <div className="pulso-gv2-picker" ref={rootRef}>
        <div className="pulso-gv2-picker-head">
          <div className="pulso-gv2-picker-head-main">
            <span className="pulso-gv2-picker-head-mark" aria-hidden="true">
              <Layers3 size={17} />
            </span>
            <div>
              <div className="pulso-gv2-picker-eyebrow">Biblioteca de modelos</div>
              <div className="pulso-gv2-picker-title">Insertar modelo</div>
              <div className="pulso-gv2-picker-sub">{ALL_TYPES.length} modelos de composición</div>
            </div>
          </div>
          <button
            type="button"
            className="pulso-gv2-picker-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="pulso-gv2-picker-stage">
          <aside className="pulso-gv2-picker-rail" aria-label="Familias de modelos">
            <div className="pulso-gv2-picker-rail-kicker">Familias</div>
            <div className="pulso-gv2-picker-tabs">
              {ORDER.map((c) => {
                const { Icon, hint } = CAT_META[c];
                return (
                  <button
                    key={c}
                    type="button"
                    className={`pulso-gv2-picker-tab ${filter === c ? "is-active" : ""}`}
                    onClick={() => setFilter(c)}
                    aria-pressed={filter === c}
                  >
                    <span className="pulso-gv2-picker-tab-icon" aria-hidden="true">
                      <Icon size={14} />
                    </span>
                    <span className="pulso-gv2-picker-tab-copy">
                      <span>{CAT_LABEL_WITH_ALL[c]}</span>
                      <small>{hint}</small>
                    </span>
                    <span className="pulso-gv2-picker-tab-count">{categoryCounts[c]}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="pulso-gv2-picker-library" data-cat={filter} aria-label={`Modelos: ${activeLabel}`}>
            <div className="pulso-gv2-picker-library-head">
              <div className="pulso-gv2-picker-library-title">
                <span className="pulso-gv2-picker-library-icon" aria-hidden="true">
                  <activeMeta.Icon size={14} />
                </span>
                <div>
                  <strong>{activeLabel}</strong>
                  <span>{activeMeta.hint}</span>
                </div>
              </div>
              <div className="pulso-gv2-picker-library-count">
                {filtered.length} modelos visibles
              </div>
            </div>

            <div className="pulso-gv2-picker-search-wrap">
              <Search size={13} className="pulso-gv2-picker-search-icon" />
              <input
                ref={inputRef}
                type="text"
                className="pulso-gv2-picker-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar modelo…"
                aria-label="Buscar modelo"
              />
            </div>

            <div className="pulso-gv2-picker-grid" role="list" aria-label="Modelos disponibles">
              {filtered.map((t) => {
                const meta = slidesById[t];
                const cat = categoryOf(t);
                const pattern = blueprintPattern(t);
                const slots = meta?.slots ?? [];
                const selected = selectedType === t;
                return (
                  <article
                    key={t}
                    className={`pulso-gv2-picker-tile ${selected ? "is-selected" : ""}`}
                    data-cat={cat}
                    role="listitem"
                    aria-current={selected ? "true" : undefined}
                    aria-label={`${SLIDE_LABELS[t]}. ${modelSlotLabel(t)}. Seleccionar modelo`}
                    tabIndex={0}
                    onClick={() => setSelectedType(t)}
                    onDoubleClick={() => insertSlide(t)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedType(t);
                    }}
                  >
                    <span className="pulso-gv2-picker-tile-icon">
                      <SlideTypeIcon tipo={t} iconoUi={meta?.icono_ui} size={23} />
                    </span>
                    <span className="pulso-gv2-picker-tile-copy">
                      <span className="pulso-gv2-picker-tile-meta-row">
                        <span className="pulso-gv2-picker-tile-meta">{CAT_LABEL_WITH_ALL[cat]}</span>
                        <span className="pulso-gv2-picker-tile-structure">{modelStructureLabel(pattern)}</span>
                      </span>
                      <span className="pulso-gv2-picker-tile-label">{SLIDE_LABELS[t]}</span>
                      {meta?.descripcion && (
                        <span className="pulso-gv2-picker-tile-desc">{meta.descripcion}</span>
                      )}
                      <span className="pulso-gv2-picker-tile-tags" aria-label={`Estructura del modelo: ${modelSlotLabel(t)}`}>
                        <span>{modelSlotLabel(t)}</span>
                      </span>
                    </span>
                    <button
                      type="button"
                      className="pulso-gv2-picker-tile-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        insertSlide(t);
                      }}
                    >
                      <Plus size={11} /> Insertar
                    </button>
                    <SlideModelMiniature type={t} slots={slots} scale="card" iconoUi={meta?.icono_ui} />
                  </article>
                );
              })}
              {filtered.length === 0 && (
                <div className="pulso-gv2-picker-empty">
                  Ningún modelo coincide con "{query}".
                </div>
              )}
            </div>
          </section>

          <aside className="pulso-gv2-picker-inspector" data-cat={selectedCategory} aria-label="Detalle del modelo seleccionado">
            {filtered.length === 0 ? (
              <div className="pulso-gv2-picker-inspector-empty">
                <Search size={18} />
                <strong>Sin resultados</strong>
                <span>Prueba con “gráfico”, “texto”, “población” o limpia la búsqueda.</span>
              </div>
            ) : (
              <>
                <div className="pulso-gv2-picker-inspector-head">
                  <span className="pulso-gv2-picker-inspector-icon" aria-hidden="true">
                    <Eye size={15} />
                  </span>
                  <div>
                    <span>Vista previa PPT</span>
                    <strong>{modelStructureLabel(selectedPattern)}</strong>
                  </div>
                </div>

                <SlideModelMiniature type={selectedType} slots={selectedSlots} scale="hero" iconoUi={selectedMeta?.icono_ui} />

                <div className="pulso-gv2-picker-inspector-copy">
                  <span className="pulso-gv2-picker-inspector-family">{CAT_LABEL_WITH_ALL[selectedCategory]}</span>
                  <h3>{SLIDE_LABELS[selectedType]}</h3>
                  <p>{selectedMeta?.descripcion ?? "Modelo listo para construir una lámina del reporte."}</p>
                </div>

                <div className="pulso-gv2-picker-inspector-facts">
                  <span>
                    <CheckCircle2 size={13} /> {modelSlotLabel(selectedType)}
                  </span>
                  <span>{selectedSlotCount > 0 ? "Con gráficos" : "Editorial"}</span>
                </div>

                <div className="pulso-gv2-picker-inspector-slots" aria-label="Zonas del modelo">
                  {selectedSlotItems.length > 0 ? (
                    selectedSlotItems.map((slot) => <span key={slot}>{slot}</span>)
                  ) : (
                    <span>Sin slots de gráfico</span>
                  )}
                </div>

                <button
                  type="button"
                  className="pulso-gv2-picker-insert-primary"
                  onClick={() => insertSlide(selectedType)}
                >
                  <FilePlus2 size={16} />
                  <span>Insertar modelo</span>
                  <ArrowRight size={15} />
                </button>

                <p className="pulso-gv2-picker-inspector-note">
                  Luego podrás elegir variables, cruces y estilo desde el editor del slide.
                </p>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function modelStructureLabel(pattern: BlueprintPattern): string {
  switch (pattern) {
    case "grid":
      return "Matriz";
    case "population":
      return "Población";
    case "split":
      return "Dos zonas";
    case "narrative":
      return "Narrativo";
    case "single":
      return "Visual único";
    case "cover":
      return "Editorial";
    default:
      return "Editorial";
  }
}

function modelSlotLabel(type: SlideType): string {
  if (type.includes("6_graficos")) return "6 slots";
  if (type.includes("5_graficos")) return "5 slots";
  if (type.includes("4_graficos")) return "4 slots";
  if (type.includes("2_graficos")) return "2 slots";
  if (type.includes("1_grafico") || type.includes("grafico_texto")) return "1 slot";
  return "Base editorial";
}

function blueprintPattern(type: SlideType): BlueprintPattern {
  if (type.includes("poblacion")) return "population";
  if (type.includes("4_graficos") || type.includes("5_graficos") || type.includes("6_graficos")) return "grid";
  if (type.includes("2_graficos") || type.includes("texto_derecha") || type.includes("texto_izquierda")) return "split";
  if (type.includes("narrativo") || type.includes("texto")) return "narrative";
  if (type.includes("1_grafico")) return "single";
  return "cover";
}

function blueprintLayout(type: SlideType): SlidePreviewLayout {
  switch (type) {
    case "p_slide_indice":
      return "index";
    case "p_slide_seccion":
      return "section";
    case "p_slide_objetivo_icono":
      return "objective";
    case "p_slide_texto":
      return "text";
    case "p_slide_tabla_tecnica":
      return "technical";
    case "p_slide_1_grafico":
      return "single";
    case "p_slide_1_grafico_narrativo":
      return "singleNarrative";
    case "p_slide_grafico_texto_derecha":
      return "splitRight";
    case "p_slide_grafico_texto_izquierda":
      return "splitLeft";
    case "p_slide_2_graficos":
      return "two";
    case "p_slide_2_graficos_narrativo":
      return "twoNarrative";
    case "p_slide_2_graficos_texto_izquierda":
      return "twoTextLeft";
    case "p_slide_2_graficos_texto_derecha":
      return "twoTextRight";
    case "p_slide_4_graficos":
      return "grid4";
    case "p_slide_2_graficos_poblacion":
      return "population2";
    case "p_slide_4_graficos_poblacion":
      return "population4";
    case "p_slide_5_graficos_poblacion":
      return "population5";
    case "p_slide_6_graficos_poblacion":
      return "population6";
    default:
      return "cover";
  }
}

function pptLayoutName(type: SlideType): string {
  switch (type) {
    case "p_slide_1_grafico":
      return "Graficos";
    case "p_slide_2_graficos":
      return "Graficos_2columnas";
    case "p_slide_1_grafico_narrativo":
      return "1_Grafico_narrativo";
    case "p_slide_2_graficos_narrativo":
      return "1_Graficos_2columnas_narrativo";
    case "p_slide_grafico_texto_derecha":
      return "right_grafico_texto";
    case "p_slide_grafico_texto_izquierda":
      return "left_grafico_texto";
    case "p_slide_2_graficos_texto_derecha":
      return "right_2graficos_texto";
    case "p_slide_2_graficos_texto_izquierda":
      return "left_2graficos_texto";
    case "p_slide_4_graficos":
      return "4_paneles";
    case "p_slide_2_graficos_poblacion":
      return "poblacion_2";
    case "p_slide_4_graficos_poblacion":
      return "poblacion_4";
    case "p_slide_5_graficos_poblacion":
      return "poblacion_5";
    case "p_slide_6_graficos_poblacion":
      return "poblacion_6";
    case "p_slide_indice":
      return "Indice";
    case "p_slide_seccion":
      return "Section Header";
    case "p_slide_objetivo_icono":
      return "Objetivos_Secciones";
    case "p_slide_texto":
    case "p_slide_tabla_tecnica":
      return "Title and Content";
    default:
      return "Title Slide";
  }
}

function SlideModelMiniature({
  type,
  slots,
  scale = "card",
  iconoUi,
}: {
  type: SlideType;
  slots: string[];
  scale?: PreviewScale;
  iconoUi?: string;
}) {
  const layout = blueprintLayout(type);
  const slotCount = inferredSlotCount(type) || slots.length;
  const slotItems = Array.from({ length: Math.min(slotCount, 6) }, (_, index) => index + 1);

  return (
    <span
      className={`pulso-gv2-picker-slide-preview is-${scale}`}
      data-layout={layout}
      data-ppt-layout={pptLayoutName(type)}
      data-slots={slotCount}
      aria-hidden="true"
    >
      <span className="pulso-gv2-picker-slide-paper">
        <span className="pulso-gv2-picker-slide-report-title" />
        <span className="pulso-gv2-picker-slide-logo">
          <i />
          <b />
        </span>
        <span className="pulso-gv2-picker-slide-frame" />
        <span className="pulso-gv2-picker-slide-band is-top" />
        <span className="pulso-gv2-picker-slide-title">
          <i />
          <i />
        </span>
        <span className="pulso-gv2-picker-slide-copy">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="pulso-gv2-picker-slide-table">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="pulso-gv2-picker-slide-icon">
          <SlideTypeIcon
            tipo={type}
            iconoUi={iconoUi}
            size={scale === "hero" ? 24 : 18}
            className="pulso-gv2-picker-slide-icon-svg"
          />
        </span>
        <span className="pulso-gv2-picker-slide-slots">
          {slotItems.map((slot) => (
            <span key={slot} className="pulso-gv2-picker-slide-slot">
              <span className="pulso-gv2-picker-slide-slot-icon" />
            </span>
          ))}
        </span>
        <span className="pulso-gv2-picker-slide-band is-bottom" />
        <span className="pulso-gv2-picker-slide-base" />
      </span>
    </span>
  );
}

function inferredSlotCount(type: SlideType): number {
  if (type.includes("6_graficos")) return 6;
  if (type.includes("5_graficos")) return 5;
  if (type.includes("4_graficos")) return 4;
  if (type.includes("2_graficos")) return 2;
  if (type.includes("1_grafico") || type.includes("grafico_texto")) return 1;
  return 0;
}

// Botón trigger del picker. Lo monta el TimelinePanelV2.
export function SlidePickerTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="pulso-gv2-picker-trigger"
      onClick={onOpen}
    >
      <Plus size={14} />
      <span>Agregar slide</span>
    </button>
  );
}
