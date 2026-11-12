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
 * - **Es navegación, no un tablist.** Cada sección es un `<Link>` con
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

import { Link } from "react-router-dom";

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
  /** Sección ya completada. Se marca con un punto, sin depender del numeral. */
  done?: boolean;
  /**
   * Prerrequisito que falta. La sección sigue siendo navegable a propósito —
   * bloquear la navegación esconde el problema en vez de explicarlo.
   */
  lockedReason?: string;
  /**
   * Una línea más para el tooltip y el lector de pantalla cuando la sección
   * no está bloqueada («falta la base», «sección lista»).
   */
  nota?: string;
  /**
   * Cuántas cosas faltan por hacer en la sección. Se pinta como número en ámbar;
   * con 0 o sin valor no se pinta nada. Es la única cifra que lleva la píldora:
   * ni fracciones ni totales, para que el número signifique siempre lo mismo.
   */
  pendientes?: number;
  /** La sección quedó lista: se pinta un ✓. Cede ante `pendientes`. */
  lista?: boolean;
  /** La sección quedó desactualizada: se pinta un punto ámbar. Manda sobre `lista` y cede ante `pendientes`. */
  desactualizada?: boolean;
};

export type SectionPillbarProps = {
  modulo: ProsecnurModuleSlug;
  items: readonly SectionPillbarItem[];
  /**
   * La sección activa la decide el llamador, no la ruta: con secciones en la query
   * (`?seccion=`) un `NavLink` marcaba `aria-current` en TODAS (brecha B3).
   */
  seccionActiva: string | null;
  progreso?: SectionPillbarProgreso;
  densidad?: "normal" | "compact";
  ariaLabel: string;
  /** Clase de la píldora deslizante (GlidingTabList). */
  className?: string;
  /** Clase del `<nav>`: ubicación en el chrome y tokens del módulo. */
  navClassName?: string;
};

export function SectionPillbar({
  modulo,
  items,
  seccionActiva,
  progreso = "none",
  densidad = "normal",
  ariaLabel,
  className,
  navClassName,
}: SectionPillbarProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className={["pulso-phase-rail pulso-section-pillbar", navClassName].filter(Boolean).join(" ")}
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
        <ol
          className="pulso-phase-pill-list"
          data-qa-geometry-group="chrome/secciones"
          data-qa-geometry-contract="intrinsic"
        >
          {items.map((item, indice) => {
            const activa = item.id === seccionActiva;
            const texto = densidad === "compact" ? (item.shortLabel ?? item.label) : item.label;
            const pendientes = item.pendientes && item.pendientes > 0 ? item.pendientes : 0;
            const marca = pendientes
              ? `${pendientes.toLocaleString("es-PE")} ${pendientes === 1 ? "pendiente" : "pendientes"}`
              : item.desactualizada ? "desactualizada" : item.lista ? "lista" : "";
            const detalle = [item.lockedReason ?? item.nota, marca].filter(Boolean).join(". ");
            return (
              <li key={item.id} className="pulso-phase-pill-item">
                <Link
                  to={item.href}
                  data-gliding-key={item.id}
                  data-nav-item=""
                  data-nav-shape="pill"
                  data-nav-state={activa ? "selected" : undefined}
                  aria-current={activa ? "page" : undefined}
                  title={item.lockedReason ?? item.nota ?? item.label}
                  aria-label={detalle ? `${item.label}. ${detalle}` : undefined}
                  className={[
                    "pulso-phase-pill",
                    activa ? "is-active" : "",
                    item.done ? "is-done" : "",
                    item.lockedReason ? "is-blocked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="pulso-phase-pill-circle" aria-hidden="true" />
                  <span className="pulso-phase-pill-stack">
                    <span className="pulso-phase-pill-label">
                      <span className="pulso-phase-pill-text">{texto}</span>
                    </span>
                  </span>
                  {pendientes ? (
                    <span className="pulso-phase-pill-badge" data-estado="pendiente" aria-hidden="true">
                      {pendientes.toLocaleString("es-PE")}
                    </span>
                  ) : item.desactualizada ? (
                    <span className="pulso-phase-pill-badge" data-estado="desactualizada" aria-hidden="true" />
                  ) : item.lista ? (
                    <span className="pulso-phase-pill-badge" data-estado="lista" aria-hidden="true">✓</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </GlidingTabList>
    </nav>
  );
}
