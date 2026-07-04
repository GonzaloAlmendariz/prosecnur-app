import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, X, AlertCircle, AlertTriangle } from "lucide-react";
import { GraficadorRef, Slide, VarInfo } from "../../../../api/client";
import { usePlanStore, SLIDE_GRAF_SLOTS, SLIDE_LABELS } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { ValidationIssue } from "../../usePlanValidator";
import { SlideTypeIcon } from "../../SlideTypeIcon";
import { GraficadorTypeIcon } from "../../GraficadorTypeIcon";
import { graficadorDisplayName, humanizeIdentifier } from "../../graficadorDisplay";
import { categoryOf, CATEGORY_LABEL } from "./categoryOf";
import { slideDisplayTitle } from "../../slideAutoTitle";

export type SlideCardProps = {
  slide: Slide;
  index: number;
  active: boolean;
  issues: ValidationIssue[];
  variables: VarInfo[];
};

// Card de slide en el timeline V2. Es draggable y funciona como firma visual
// de estructura: índice, tipo de lámina y gráficos usados, sin exponer textos
// editables del usuario en la navegación lateral.

export function SlideCard({ slide, index, active, issues, variables }: SlideCardProps) {
  const select = usePlanStore((s) => s.select);
  const removeSlide = usePlanStore((s) => s.removeSlide);
  const duplicateSlide = usePlanStore((s) => s.duplicateSlide);
  const { slidesById, graficadoresById } = useGraficosRegistry();
  const meta = slidesById[slide.tipo];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    animationDelay: `${Math.min(index, 12) * 30}ms`,
  };

  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warning").length;
  const cat = categoryOf(slide.tipo);
  const titulo = slideDisplayTitle(slide, variables);
  const slideTypeLabel = SLIDE_LABELS[slide.tipo] ?? humanizeIdentifier(slide.tipo, "Slide");
  const timelineTypeLabel = compactTimelineSlideLabel(slideTypeLabel);
  const graphItems = graphItemsForSlide(slide, graficadoresById);
  const graphCount = graphItems.reduce((total, item) => total + item.count, 0);

  const isSeparator = slide.tipo === "p_slide_seccion";

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-cat={cat}
      className={`pulso-gv2-slide-card ${active ? "is-active" : ""} ${isDragging ? "is-dragging" : ""} ${isSeparator ? "is-separator" : ""} ${graphCount > 0 ? "has-graphs" : ""} ${graphCount > 1 ? "has-multiple-graphs" : ""}`}
      data-graph-count={graphCount}
      onClick={() => select(slide.id)}
      role="button"
      tabIndex={0}
      aria-label={`Slide ${index + 1}. ${slideTypeLabel}${titulo ? `. ${titulo}` : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select(slide.id);
        }
      }}
      aria-pressed={active}
    >
      <div className="pulso-gv2-slide-card-head">
        <span
          className="pulso-gv2-slide-card-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Arrastrar para reordenar. ${CATEGORY_LABEL[cat]}`}
        >
          <GripVertical size={12} />
        </span>
        <span className="pulso-gv2-slide-card-index">#{index + 1}</span>
        {(errors > 0 || warns > 0) && (
          <span
            className={`pulso-gv2-slide-card-diag ${errors > 0 ? "is-error" : "is-warn"}`}
            aria-label={`${errors > 0 ? `${errors} error(es)` : ""}${errors > 0 && warns > 0 ? ". " : ""}${warns > 0 ? `${warns} aviso(s)` : ""}`}
          >
            {errors > 0 ? <AlertCircle size={10} strokeWidth={3} /> : <AlertTriangle size={10} strokeWidth={3} />}
          </span>
        )}
      </div>

      <div className="pulso-gv2-slide-card-title">
        <span className="pulso-gv2-slide-card-type-icon" aria-hidden="true">
          <SlideTypeIcon tipo={slide.tipo} iconoUi={meta?.icono_ui} size={12} />
        </span>
        <span className="pulso-gv2-slide-card-title-label">{timelineTypeLabel}</span>
        {graphCount > 2 && (
          <span className="pulso-gv2-slide-card-graph-count">
            {graphCount} gráficos
          </span>
        )}
      </div>

      {graphItems.length > 0 && (
        <div
          className="pulso-gv2-slide-card-models"
          aria-label={`Gráficos usados: ${graphItems.map((item) => item.ariaLabel).join(", ")}`}
        >
          {graphItems.slice(0, 2).map((item) => (
            <span
              className="pulso-gv2-slide-card-model"
              key={`${item.slot}-${item.name}`}
              title={item.ariaLabel}
            >
              <span className="pulso-gv2-slide-card-model-icon" aria-hidden="true">
                <GraficadorTypeIcon name={item.name} iconoUi={item.iconoUi} size={12} />
              </span>
              <span className="pulso-gv2-slide-card-model-label">{item.label}</span>
              {item.count > 1 && (
                <span className="pulso-gv2-slide-card-model-count" aria-hidden="true">
                  x{item.count}
                </span>
              )}
            </span>
          ))}
          {graphItems.length > 2 && (
            <span className="pulso-gv2-slide-card-model is-more">
              +{graphItems.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="pulso-gv2-slide-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="pulso-icon"
          onClick={() => duplicateSlide(slide.id)}
          aria-label="Duplicar slide"
        >
          <Copy size={11} />
        </button>
        <button
          type="button"
          className="pulso-icon pulso-icon-danger"
          onClick={() => removeSlide(slide.id)}
          aria-label="Eliminar slide"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

type GraphTimelineItem = {
  slot: string;
  name: string;
  label: string;
  ariaLabel: string;
  iconoUi?: string;
  count: number;
};

type GraphMetaLookup = Record<string, { titulo_humano?: string | null; icono_ui?: string | null } | undefined>;

function compactTimelineSlideLabel(label: string): string {
  return label
    .replace(/^Un gráfico\b/, "1 gráfico")
    .replace(/^Dos gráficos\b/, "2 gráficos")
    .replace(/\s+\(población\)$/i, "")
    .replace(/^Separador de sección$/i, "Separador");
}

function graphItemsForSlide(slide: Slide, graficadoresById: GraphMetaLookup): GraphTimelineItem[] {
  const slots = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];
  const payload = slide.payload as Record<string, unknown>;
  const entries = slots.length > 0
    ? slots.map((slot) => [slot, payload[slot]] as const)
    : Object.entries(payload);

  const grouped = new Map<string, {
    slots: string[];
    name: string;
    label: string;
    iconoUi?: string;
  }>();

  for (const [slot, value] of entries) {
    if (!isGraficadorRef(value)) continue;
    const meta = graficadoresById[value.graficador];
    const label = graficadorDisplayName(value.graficador, meta);
    const current = grouped.get(value.graficador);
    if (current) {
      current.slots.push(slot);
      continue;
    }
    grouped.set(value.graficador, {
      slots: [slot],
      name: value.graficador,
      label,
      iconoUi: meta?.icono_ui ?? undefined,
    });
  }

  return Array.from(grouped.values()).map((item) => {
    const count = item.slots.length;
    return {
      slot: item.slots.join("+"),
      name: item.name,
      label: item.label,
      ariaLabel: count > 1 ? `${count} gráficos de ${item.label}` : item.label,
      iconoUi: item.iconoUi,
      count,
    };
  });
}

function isGraficadorRef(value: unknown): value is GraficadorRef {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { graficador?: unknown }).graficador === "string",
  );
}
