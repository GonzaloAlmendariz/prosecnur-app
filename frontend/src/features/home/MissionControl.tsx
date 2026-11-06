import { useLayoutEffect, useRef } from "react";
import { PROSECNUR_PRIMARY_ACTIVE_MODULES } from "../../lib/modules";
import type { ProjectOverview } from "../../api/client";
import { ModuleStatusCard } from "./ModuleStatusCard";
import { HomeHero } from "./HomeHero";
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
  nombreOficial,
}: {
  /** El nombre de la Ficha (`undefined` mientras se lee, `""` si no está declarado). */
  nombreOficial?: string;
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
    overview.project.code,
    overview.project.client,
    overview.project.project_file,
    formatSavedAt(overview.project.saved_at),
  ].filter(Boolean);

  return (
    <section
      className="home-mission"
      aria-label="Estado del proyecto"
      data-audit-ready="home"
      // Las columnas viven en la sección: la franja «desde tu última apertura»
      // toma el mismo techo que la rejilla y no queda más ancha que las tarjetas.
      style={{
        ["--home-cols" as string]: gridColumns(cards.length),
        ["--home-filas" as string]: Math.max(1, Math.ceil(cards.length / gridColumns(cards.length))),
      }}
    >
      {/* 5 nov 2026: la cabecera del estudio (nombre, meta y «desde tu última apertura») en la fila que antes
          ocupaba sólo la franja. El chip del topbar dice qué ARCHIVO está abierto; la cabecera, qué ESTUDIO. */}
      <HomeHero overview={overview} nombreOficial={nombreOficial} />

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
