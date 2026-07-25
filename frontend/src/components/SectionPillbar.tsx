/**
 * Rail de secciones — patrón maestro #2 (ADR 0038, ratificado por el 0042).
 *
 * El segundo nivel de la jerarquía (módulo → modo → **sección** → pestaña →
 * panel) como un componente en vez de como un marcado copiado. Hoy hay ocho
 * nombres de clase para este rail y seis módulos que repiten el mismo `<ol>` de
 * píldoras a mano; el que no lo repetía se escribió otro sistema entero.
 *
 * Tres decisiones que el componente impone y el marcado copiado no podía:
 *
 * - **Es navegación, no un tablist.** Cada sección es un `<NavLink>` con
 *   `aria-current="page"`. Un `role="tab"` sobre rutas es una promesa falsa al
 *   lector de pantalla —no hay `tabpanel` que le corresponda— y además dejaría
 *   estas píldoras bajo la regla `!important` de `aria-selected` que impide el
 *   hover del activo. Con `aria-current` quedan fuera de eso por construcción.
 * - **La numeración solo aparece con pipeline real.** Es un tipo, no disciplina:
 *   `progreso: "none"` es el default y solo Procesamiento y Cálculo de muestra
 *   piden numerar. Antes, dos módulos numeraban secciones que no eran pasos.
 * - **Los estados los pinta `nav-states.css`.** El componente emite
 *   `data-nav-item` / `data-nav-state` / `data-nav-shape="pill"` y no declara ni
 *   un color: hover, activo, foco y deshabilitado tienen un dueño único.
 *
 * El indicador que se desliza sigue siendo `GlidingTabList`, que ya está probado
 * por nueve contract tests. Esto lo envuelve; no lo reescribe.
 */

import { NavLink } from "react-router-dom";

import { GlidingTabList } from "./GlidingTabList";
import type { ProsecnurModuleSlug } from "../lib/modules";
import "./chrome.css";

export type SectionPillbarProgreso = "none" | "numbered";

export type SectionPillbarItem = {
  id: string;
  label: string;
  /** Reemplaza al label cuando la densidad aprieta. */
  shortLabel?: string;
  /** Href canónico. Lo produce `useSeccion().hrefDe("seccion", id)`. */
  href: string;
  /** Sección ya completada. Solo se dibuja si `progreso` la pide. */
  done?: boolean;
  /**
   * Prerrequisito que falta. La sección sigue siendo navegable a propósito —
   * bloquear la navegación esconde el problema en vez de explicarlo.
   */
  lockedReason?: string;
};

export type SectionPillbarProps = {
  modulo: ProsecnurModuleSlug;
  items: readonly SectionPillbarItem[];
  seccionActiva: string | null;
  progreso?: SectionPillbarProgreso;
  densidad?: "normal" | "compact";
  ariaLabel: string;
  className?: string;
};

export function SectionPillbar({
  modulo,
  items,
  seccionActiva,
  progreso = "none",
  densidad = "normal",
  ariaLabel,
  className,
}: SectionPillbarProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className="pulso-phase-rail pulso-section-pillbar"
      data-modulo={modulo}
      data-progreso={progreso}
      data-densidad={densidad}
      aria-label={ariaLabel}
    >
      <GlidingTabList
        activeKey={seccionActiva ?? undefined}
        mode="nav"
        className={["pulso-phase-pillbar", className].filter(Boolean).join(" ")}
      >
        <ol className="pulso-phase-pill-list">
          {items.map((item, indice) => {
            const activa = item.id === seccionActiva;
            const texto = densidad === "compact" ? (item.shortLabel ?? item.label) : item.label;
            return (
              <li key={item.id} className="pulso-phase-pill-item">
                <NavLink
                  to={item.href}
                  data-gliding-key={item.id}
                  data-nav-item=""
                  data-nav-shape="pill"
                  data-nav-state={activa ? "selected" : undefined}
                  aria-current={activa ? "page" : undefined}
                  title={item.lockedReason ?? item.label}
                  aria-label={
                    item.lockedReason ? `${item.label}. ${item.lockedReason}` : undefined
                  }
                  className={[
                    "pulso-phase-pill",
                    activa ? "is-active" : "",
                    item.done && progreso === "numbered" ? "is-done" : "",
                    item.lockedReason ? "is-blocked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="pulso-phase-pill-circle" aria-hidden="true" />
                  <span className="pulso-phase-pill-stack">
                    <span className="pulso-phase-pill-label">
                      {progreso === "numbered" && (
                        <span className="pulso-phase-pill-number">{indice + 1}</span>
                      )}
                      <span className="pulso-phase-pill-text">{texto}</span>
                    </span>
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ol>
      </GlidingTabList>
    </nav>
  );
}
