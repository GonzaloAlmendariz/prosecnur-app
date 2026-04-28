import { useEffect, useMemo, useRef, useState } from "react";
import * as Lucide from "lucide-react";
import { Plus, Search, X } from "lucide-react";
import { SlideType } from "../../../../api/client";
import { usePlanStore, SLIDE_LABELS } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
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

const CAT_LABEL_WITH_ALL: Record<"all" | SlideCategory, string> = {
  all: "Todos",
  ...CATEGORY_LABEL,
};

type LucideIcon = (props: { size?: number }) => JSX.Element;
function resolveIcon(name: string | undefined): LucideIcon {
  const reg = Lucide as unknown as Record<string, LucideIcon>;
  return (name && reg[name]) || reg["FileText"] || reg["Square"];
}

export type SlidePickerProps = {
  open: boolean;
  onClose: () => void;
};

export function SlidePicker({ open, onClose }: SlidePickerProps) {
  const addSlide = usePlanStore((s) => s.addSlide);
  const { slidesById } = useGraficosRegistry();
  const [filter, setFilter] = useState<"all" | SlideCategory>("all");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Auto-focus búsqueda al abrir + reset estado al cerrar
  useEffect(() => {
    if (open) {
      setQuery("");
      setFilter("all");
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

  if (!open) return null;

  return (
    <div className="pulso-gv2-picker-backdrop" role="dialog" aria-modal="true" aria-label="Agregar slide">
      <div className="pulso-gv2-picker" ref={rootRef}>
        <div className="pulso-gv2-picker-head">
          <div>
            <div className="pulso-gv2-picker-title">Agregar slide</div>
            <div className="pulso-gv2-picker-sub">Elige una plantilla. Puedes editarla después.</div>
          </div>
          <button
            type="button"
            className="pulso-gv2-picker-close"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="pulso-gv2-picker-search-wrap">
          <Search size={13} className="pulso-gv2-picker-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="pulso-gv2-picker-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar plantilla…"
            aria-label="Buscar plantilla"
          />
        </div>

        <div className="pulso-gv2-picker-tabs">
          {ORDER.map((c) => (
            <button
              key={c}
              type="button"
              className={`pulso-gv2-picker-tab ${filter === c ? "is-active" : ""}`}
              onClick={() => setFilter(c)}
              aria-pressed={filter === c}
            >
              {CAT_LABEL_WITH_ALL[c]}
            </button>
          ))}
        </div>

        <div className="pulso-gv2-picker-grid">
          {filtered.map((t) => {
            const meta = slidesById[t];
            const Icon = resolveIcon(meta?.icono_ui);
            const cat = categoryOf(t);
            return (
              <button
                key={t}
                type="button"
                className="pulso-gv2-picker-tile"
                data-cat={cat}
                onClick={() => { addSlide(t); onClose(); }}
                title={meta?.descripcion ?? ""}
              >
                <span className="pulso-gv2-picker-tile-icon">
                  <Icon size={20} />
                </span>
                <span className="pulso-gv2-picker-tile-label">{SLIDE_LABELS[t]}</span>
                {meta?.descripcion && (
                  <span className="pulso-gv2-picker-tile-desc">{meta.descripcion}</span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="pulso-gv2-picker-empty">
              Ninguna plantilla coincide con "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Botón trigger del picker. Lo monta el TimelinePanelV2.
export function SlidePickerTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="pulso-gv2-picker-trigger"
      onClick={onOpen}
      title="Agregar slide"
    >
      <Plus size={14} />
      <span>Agregar slide</span>
    </button>
  );
}
