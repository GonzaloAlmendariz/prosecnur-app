import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { PROSECNUR_PRIMARY_ACTIVE_MODULES } from "../../lib/modules";
import type { ProjectOverview } from "../../api/client";
import { ModuleStatusCard } from "./ModuleStatusCard";
import { buildModuleCardView, formatSavedAt, type ProcState } from "./moduleCardModel";

export type { ProcState } from "./moduleCardModel";

export function MissionControl({
  overview,
  proc,
  addedSlugs,
  onAddModule,
  onRemoveModule,
}: {
  overview: ProjectOverview;
  proc: ProcState;
  addedSlugs: string[];
  onAddModule: () => void;
  onRemoveModule: (slug: string) => void;
}) {
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);

  const cards = PROSECNUR_PRIMARY_ACTIVE_MODULES.filter((module) =>
    addedSlugs.includes(module.slug),
  ).map((module) => ({
    module,
    view: buildModuleCardView(module, overview, proc),
  }));

  const confirmModule = cards.find((card) => card.module.slug === confirmSlug)?.module;

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const addedKey = addedSlugs.join(",");

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    cardRefs.current.forEach((element, slug) => {
      nextRects.set(slug, element.getBoundingClientRect());
    });
    const reduce =
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if (!reduce) {
      cardRefs.current.forEach((element, slug) => {
        const previous = prevRects.current.get(slug);
        const next = nextRects.get(slug);
        if (!previous || !next) return;
        const dx = previous.left - next.left;
        const dy = previous.top - next.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        element.style.transform = `translate(${dx}px, ${dy}px)`;
        element.style.transition = "none";
        requestAnimationFrame(() => {
          element.style.transform = "";
          element.style.transition = "transform 460ms cubic-bezier(0.32, 0.72, 0, 1)";
          const clear = () => {
            element.style.transition = "";
            element.removeEventListener("transitionend", clear);
          };
          element.addEventListener("transitionend", clear);
        });
      });
    }
    prevRects.current = nextRects;
  }, [addedKey]);

  const metaLine = [
    overview.project.client,
    overview.project.project_file,
    formatSavedAt(overview.project.saved_at),
  ].filter(Boolean);

  return (
    <section
      className="home-mission"
      aria-label="Estado del proyecto"
      data-audit-ready="home"
    >
      <header className="home-mission-head">
        <div className="home-mission-id">
          <p className="home-mission-kicker">Proyecto</p>
          <h1 className="home-mission-title">{overview.project.name}</h1>
          {metaLine.length > 0 && (
            <p className="home-mission-client">
              {metaLine.map((part, index) => (
                <span key={index}>
                  {index > 0 && (
                    <span className="home-mission-meta-dot" aria-hidden="true">·</span>
                  )}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
        <button type="button" className="home-mission-add-btn" onClick={onAddModule}>
          <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
          <span>Agregar módulo</span>
        </button>
      </header>

      <div
        className="home-mission-grid"
        data-density={cards.length <= 3 ? "spacious" : cards.length <= 6 ? "balanced" : "dense"}
      >
        {cards.map(({ module, view }, index) => (
          <ModuleStatusCard
            key={module.slug}
            ref={(element) => {
              if (element) cardRefs.current.set(module.slug, element);
              else cardRefs.current.delete(module.slug);
            }}
            module={module}
            view={view}
            index={index}
            onRequestRemove={setConfirmSlug}
          />
        ))}
      </div>

      {confirmModule && createPortal(
        <div
          className="home-confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmSlug(null)}
        >
          <div className="home-confirm" onClick={(event) => event.stopPropagation()}>
            <strong>¿Quitar {confirmModule.shortLabel} del proyecto?</strong>
            <p>
              El módulo dejará de aparecer en este proyecto. Puedes volver a agregarlo cuando
              quieras; su información no se borra.
            </p>
            <div className="home-confirm-actions">
              <button type="button" className="plan-button" onClick={() => setConfirmSlug(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="home-confirm-remove"
                onClick={() => {
                  onRemoveModule(confirmModule.slug);
                  setConfirmSlug(null);
                }}
              >
                Quitar del proyecto
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
