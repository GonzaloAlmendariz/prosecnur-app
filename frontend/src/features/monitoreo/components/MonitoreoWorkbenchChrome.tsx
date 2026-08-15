import { useEffect, useRef } from "react";
import type { MonitoreoWorkbenchChromeProps } from "./MonitoreoWorkbenchChrome.types";
import CalidadDeCampo from "./CalidadDeCampo";
import { useCalidadDeCampo } from "./useCalidadDeCampo";

/**
 * Dónde se muestran las señales de cómo se está trabajando.
 *
 * En Avance porque ahí viven las alertas de cuánto falta y el GOAL pide que
 * convivan sin confundirse, y en Validación porque es la sección de calidad del
 * módulo. Fuera de esas dos —Fuentes, Modelo, Consultas— serían ruido: nadie
 * llega ahí a decidir a quién llamar hoy.
 */
const SECCIONES_CON_CALIDAD_DE_CAMPO = new Set(["avance", "calidad"]);

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MonitoreoWorkbenchChrome({
  seccionActiva,
  rail,
  head,
  children,
  clarity = null,
  status = null,
  isTerritorial = false,
  hasReportStatus = false,
  ariaLabel = "Mesa de trabajo de monitoreo",
  ariaLive = "off",
  className,
  mainClassName,
  contentClassName,
  contentId,
  contentRole,
  contentAriaLabelledBy,
  scrollResetKey,
}: MonitoreoWorkbenchChromeProps) {
  const resolvedContentId = contentId ?? `monitoreo-${seccionActiva}-panel`;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const muestraCalidad = SECCIONES_CON_CALIDAD_DE_CAMPO.has(seccionActiva);
  // Relee al cambiar de sección: es lo que refresca el bloque después de un
  // sync sin sumar una petición por render.
  const calidad = useCalidadDeCampo(muestraCalidad ? seccionActiva : "");

  // Cambiar de pestaña deja el scroll donde estaba y aterrizas a media vista o
  // al pie de la siguiente. Volver arriba es parte de llegar a la vista nueva.
  useEffect(() => {
    if (scrollResetKey == null) return;
    const node = contentRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.querySelectorAll<HTMLElement>("[data-scroll-reset]").forEach((child) => {
      child.scrollTop = 0;
    });
  }, [scrollResetKey]);

  return (
    <section className={joinClasses("mon-workbench pulso-split-view pulso-context-tab-layout", className)} aria-label={ariaLabel}>
      {rail}
      <main
        data-qa-geometry-group="monitoring-workbench-rows"
        data-qa-geometry-contract="intrinsic"
        className={joinClasses(
          "mon-workbench-main pulso-content-area",
          isTerritorial && "is-territorial",
          hasReportStatus && "has-report-status",
          mainClassName,
        )}
        aria-live={ariaLive}
      >
        {head}
        {clarity}
        {status}
        <div
          ref={contentRef}
          data-qa-geometry-capacity="owned"
          id={resolvedContentId}
          role={contentRole}
          aria-labelledby={contentAriaLabelledBy}
          className={joinClasses(`mon-workbench-content mon-workbench-content--${seccionActiva}`, contentClassName)}
        >
          {/* Dentro del contenido y no como fila propia del `main`: ese grid
              declara sus filas por familia (`auto minmax(0,1fr)`, con y sin
              status) y un hijo de más se lleva una fila declarada — medido, el
              bloque quedaba en 25 px. Acá encabeza el contenido sin discutirle
              el marco a nadie (C2). */}
          {muestraCalidad ? <CalidadDeCampo calidad={calidad} /> : null}
          {children}
        </div>
      </main>
    </section>
  );
}
