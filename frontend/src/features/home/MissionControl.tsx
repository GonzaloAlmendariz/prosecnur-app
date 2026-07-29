import { useLayoutEffect, useRef } from "react";
import { PROSECNUR_PRIMARY_ACTIVE_MODULES } from "../../lib/modules";
import type { ProjectOverview } from "../../api/client";
import { ModuleStatusCard } from "./ModuleStatusCard";
import { buildModuleCardView, formatSavedAt, type ProcState } from "./moduleCardModel";

export type { ProcState } from "./moduleCardModel";

// Columnas por cantidad de tarjetas, para que la última fila nunca quede
// huérfana: 5-6 módulos reparten 3+3 o 3+2, y 7-8 reparten 4+4 o 4+3.
function gridColumns(count: number): number {
  if (count <= 2) return Math.max(1, count);
  if (count <= 4) return count === 4 ? 4 : 3;
  if (count <= 6) return 3;
  return 4;
}

export function MissionControl({
  overview,
  proc,
  addedSlugs,
  onRemoveModule,
}: {
  overview: ProjectOverview;
  proc: ProcState;
  addedSlugs: string[];
  onRemoveModule: (slug: string) => void;
}) {
  const cards = PROSECNUR_PRIMARY_ACTIVE_MODULES.filter((module) =>
    addedSlugs.includes(module.slug),
  ).map((module) => ({
    module,
    view: buildModuleCardView(module, overview, proc),
  }));

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
      {/* Sin franja de título. El nombre del proyecto, su archivo y el estado
          de guardado ya viven en el chip del topbar, y la norma del sistema es
          explícita: la identidad va en el chrome de la app, no en una fila
          introductoria que consume el primer viewport. Queda el h1 para
          lectores de pantalla, que sí necesitan encabezado. */}
      <h1 className="pulso-sr-only">{[overview.project.name, ...metaLine].join(" · ")}</h1>

      {/* Las columnas las decide la cantidad de módulos, no el ancho: con
          `auto-fill` seis tarjetas caían como 4+2 y la fila huérfana se leía
          rota. Por cantidad, seis quedan 3+3 y ocho 4+4. */}
      <div
        className="home-mission-grid"
        data-qa-geometry-group="home-module-cards"
        data-qa-geometry-contract="equal"
        style={{ ["--home-cols" as string]: gridColumns(cards.length) }}
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
            onRequestRemove={onRemoveModule}
          />
        ))}
      </div>
    </section>
  );
}
