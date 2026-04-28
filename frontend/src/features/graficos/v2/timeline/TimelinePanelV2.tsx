import { useEffect, useMemo, useState, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { LayoutPanelTop, Search, X, Plus } from "lucide-react";
import { usePlanStore, SLIDE_LABELS } from "../../store";
import { usePlanValidator } from "../../usePlanValidator";
import { SlideCard } from "./SlideCard";
import { SlidePicker, SlidePickerTrigger } from "./SlidePicker";
import { categoryOf, CATEGORY_LABEL, SlideCategory } from "./categoryOf";

// Timeline V2: cards sortables con @dnd-kit. Drag & drop reordena via
// `moveSlideTo` (extensión de moveSlide que acepta posición arbitraria).
// Búsqueda preserva la numeración real (#1, #2…) aunque haya filtrados.
// Diagnostics badge por slide: filtra issues por slideId.

export function TimelinePanelV2() {
  const slides = usePlanStore((s) => s.plan.slides);
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const moveSlideTo = usePlanStore((s) => s.moveSlideTo);
  const density = usePlanStore((s) => s.density);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | SlideCategory>("all");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Atajo "N" o "A" para abrir el picker (sin modificador, fuera de inputs)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        setPickerOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const { issues } = usePlanValidator();

  // Index issues by slideId para mostrar badges sin recorrer todo el plan
  // por cada card.
  const issuesBySlide = useMemo(() => {
    const map: Record<string, typeof issues> = {};
    for (const it of issues) {
      if (!it.slideId) continue;
      (map[it.slideId] ??= []).push(it);
    }
    return map;
  }, [issues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slides
      .map((s, i) => ({ slide: s, index: i }))
      .filter(({ slide }) => {
        if (catFilter !== "all" && categoryOf(slide.tipo) !== catFilter) return false;
        if (!q) return true;
        const label = (SLIDE_LABELS[slide.tipo] ?? slide.tipo).toLowerCase();
        const titulo = typeof slide.payload.titulo === "string"
          ? (slide.payload.titulo as string).toLowerCase()
          : "";
        return (
          label.includes(q) ||
          titulo.includes(q) ||
          slide.tipo.toLowerCase().includes(q)
        );
      });
  }, [slides, query, catFilter]);

  // Conteo por categoría para los chips
  const catCounts = useMemo(() => {
    const counts: Record<"all" | SlideCategory, number> = {
      all: slides.length, estructural: 0, "1g": 0, "2g": 0, grid: 0, poblacion: 0,
    };
    for (const s of slides) counts[categoryOf(s.tipo)]++;
    return counts;
  }, [slides]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    // arrayMove resolves the target index; pasamos el destino directo.
    const reordered = arrayMove(slides, oldIndex, newIndex);
    const targetIdx = reordered.findIndex((s) => s.id === active.id);
    moveSlideTo(active.id as string, targetIdx);
  }

  const ids = useMemo(() => filtered.map(({ slide }) => slide.id), [filtered]);

  return (
    <aside
      className={`pulso-gv2-timeline ${density === "compact" ? "is-compact" : ""}`}
      aria-label="Timeline de slides"
    >
      {/* KPIs arriba — overview del plan visible siempre */}
      {slides.length > 0 && (
        <div className="pulso-gv2-timeline-summary pulso-gv2-timeline-summary--top" aria-label="Resumen del plan">
          <div className="pulso-gv2-summary-stat">
            <span className="pulso-gv2-summary-num">{slides.length}</span>
            <span className="pulso-gv2-summary-label">slides</span>
          </div>
          <div className="pulso-gv2-summary-stat">
            <span className="pulso-gv2-summary-num">
              {slides.filter((s) => s.tipo === "p_slide_seccion").length}
            </span>
            <span className="pulso-gv2-summary-label">secciones</span>
          </div>
          <div className="pulso-gv2-summary-stat">
            <span className="pulso-gv2-summary-num">
              {slides.filter((s) => categoryOf(s.tipo) !== "estructural").length}
            </span>
            <span className="pulso-gv2-summary-label">con gráficos</span>
          </div>
        </div>
      )}

      <div
        className="pulso-section-eyebrow"
        style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}
      >
        <span>Timeline</span>
        {slides.length > 0 && (
          <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
            {filtered.length === slides.length
              ? `${slides.length} ${slides.length === 1 ? "slide" : "slides"}`
              : `${filtered.length} de ${slides.length}`}
          </span>
        )}
      </div>

      {/* CTA "Agregar slide" siempre arriba — el usuario quiere acceso permanente. */}
      <SlidePickerTrigger onOpen={() => setPickerOpen(true)} />
      <SlidePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      {slides.length >= 3 && (
        <>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search
              size={12}
              color="var(--pulso-text-soft)"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              ref={searchRef}
              id="pulso-gv2-timeline-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar slide… (/)"
              aria-label="Buscar slide por título o tipo"
              style={{
                width: "100%", fontSize: 12, padding: "6px 8px 6px 26px",
                border: "1px solid var(--pulso-border)", borderRadius: 5,
                background: "white", outline: "none",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
                style={{
                  position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                  width: 18, height: 18, padding: 0, background: "transparent",
                  border: "none", color: "var(--pulso-text-soft)", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {slides.length >= 5 && (
            <div className="pulso-gv2-timeline-cat-chips">
              {(["all", "estructural", "1g", "2g", "grid", "poblacion"] as const).map((c) => {
                const count = catCounts[c];
                if (c !== "all" && count === 0) return null;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`pulso-gv2-cat-chip ${catFilter === c ? "is-on" : ""}`}
                    onClick={() => setCatFilter(c)}
                    aria-pressed={catFilter === c}
                    title={c === "all" ? "Mostrar todos" : `Filtrar por ${CATEGORY_LABEL[c]}`}
                    data-cat={c === "all" ? undefined : c}
                  >
                    {c === "all" ? "Todos" : CATEGORY_LABEL[c]}
                    <span className="pulso-gv2-cat-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {slides.length === 0 ? (
        <div className="pulso-gv2-timeline-empty">
          <div className="pulso-gv2-timeline-empty-icon">
            <LayoutPanelTop size={28} />
          </div>
          <div className="pulso-gv2-timeline-empty-title">Empieza tu reporte</div>
          <div className="pulso-gv2-timeline-empty-hint">
            Agrega tu primer slide para construir el plan paso a paso.
          </div>
          <button
            type="button"
            className="pulso-gv2-timeline-empty-cta"
            onClick={() => setPickerOpen(true)}
          >
            <Plus size={14} /> Agregar slide
          </button>
          <div className="pulso-gv2-timeline-empty-hint" style={{ marginTop: 8, fontSize: 10 }}>
            Tip: pulsa <kbd className="pulso-kbd">N</kbd> en cualquier momento.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", padding: "10px 4px", fontStyle: "italic" }}>
          Ningún slide coincide con "{query}".
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="pulso-gv2-timeline-list">
              {filtered.map(({ slide, index }) => (
                <SlideCard
                  key={slide.id}
                  slide={slide}
                  index={index}
                  active={selectedSlideId === slide.id}
                  issues={issuesBySlide[slide.id] ?? []}
                  density={density}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

    </aside>
  );
}
