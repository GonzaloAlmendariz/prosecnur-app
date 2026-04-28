import * as Lucide from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, X, AlertCircle, AlertTriangle } from "lucide-react";
import { Slide } from "../../../../api/client";
import { usePlanStore, SLIDE_LABELS } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { ValidationIssue } from "../../usePlanValidator";
import SlidePreviewMockup from "../../SlidePreviewMockup";
import { categoryOf, CATEGORY_LABEL } from "./categoryOf";

type LucideIcon = (props: { size?: number }) => JSX.Element;
function resolveIcon(name: string | undefined): LucideIcon {
  const reg = Lucide as unknown as Record<string, LucideIcon>;
  return (name && reg[name]) || reg["FileText"] || reg["Square"];
}

export type SlideCardProps = {
  slide: Slide;
  index: number;
  active: boolean;
  issues: ValidationIssue[];
  density: "comfortable" | "compact";
};

// Card de slide en el timeline V2. Es draggable (handle al inicio + grab
// del card completo); muestra thumbnail mockup, título humano, índice,
// chips de override/icono compartidos, badge de diagnostics. Color-coded
// por categoría en el borde izquierdo.

export function SlideCard({ slide, index, active, issues, density }: SlideCardProps) {
  const select = usePlanStore((s) => s.select);
  const removeSlide = usePlanStore((s) => s.removeSlide);
  const duplicateSlide = usePlanStore((s) => s.duplicateSlide);
  const { slidesById } = useGraficosRegistry();
  const meta = slidesById[slide.tipo];
  const TypeIcon = resolveIcon(meta?.icono_ui);

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
  const titulo = typeof slide.payload.titulo === "string" ? slide.payload.titulo : "";

  const isSeparator = slide.tipo === "p_slide_seccion";

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-cat={cat}
      className={`pulso-gv2-slide-card ${active ? "is-active" : ""} ${isDragging ? "is-dragging" : ""} ${isSeparator ? "is-separator" : ""}`}
      onClick={() => select(slide.id)}
      role="button"
      tabIndex={0}
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
          title={`Arrastrar para reordenar · ${CATEGORY_LABEL[cat]}`}
          aria-label="Arrastrar para reordenar"
        >
          <GripVertical size={12} />
        </span>
        <span style={{ flex: 1 }}>#{index + 1}</span>
        {(errors > 0 || warns > 0) && (
          <span
            className={`pulso-gv2-slide-card-diag ${errors > 0 ? "is-error" : "is-warn"}`}
            title={`${errors > 0 ? `${errors} error(es)` : ""}${errors > 0 && warns > 0 ? " · " : ""}${warns > 0 ? `${warns} aviso(s)` : ""}`}
            style={{ position: "static" }}
          >
            {errors > 0 ? <AlertCircle size={10} strokeWidth={3} /> : <AlertTriangle size={10} strokeWidth={3} />}
          </span>
        )}
      </div>

      <div className="pulso-gv2-slide-card-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <TypeIcon size={11} />
        {SLIDE_LABELS[slide.tipo] ?? slide.tipo}
      </div>
      {titulo && (
        <div className="pulso-gv2-slide-card-subtitle" title={titulo}>
          {titulo}
        </div>
      )}

      {density === "comfortable" && (
        <div className="pulso-gv2-slide-card-thumb" aria-hidden="true">
          <div className="pulso-gv2-slide-card-thumb-mock">
            <SlidePreviewMockup slide={slide} />
          </div>
        </div>
      )}

      <div className="pulso-gv2-slide-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="pulso-icon"
          onClick={() => duplicateSlide(slide.id)}
          title="Duplicar (Cmd+D)"
          aria-label="Duplicar slide"
        >
          <Copy size={11} />
        </button>
        <button
          type="button"
          className="pulso-icon pulso-icon-danger"
          onClick={() => removeSlide(slide.id)}
          title="Eliminar"
          aria-label="Eliminar slide"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
