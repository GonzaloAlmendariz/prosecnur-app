import { useEffect, useId, useMemo, useRef, type CSSProperties } from "react";
import { marcadoTrenza } from "./trenzaMarcado";
import { poseConEntrada, poseFirma } from "./trenzaGeometria";
import "./isotipo.css";


/**
 * El isotipo como indicador de espera (ADR 0132; reemplaza al «Ecualizador» que latía). Nunca desaparece:
 *  - `carga` (por defecto): los siete hilos se tuercen al montar y la cuerda queda girando sin corte mientras dure
 *    la espera, con una respiración suave. Es el de la carga del proyecto, la carga de módulo y el bloque de carga.
 *  - `firma`: la misma entrada, que se asienta en la pose quieta y se detiene (selector de proyecto).
 * Con movimiento reducido o `detenido` (error) queda en la pose del logo. El contenedor toma `fondo`: por defecto el
 * tono del módulo cuando lo hay y el navy de marca en el resto.
 *
 * La animación NO pasa por React (R11-1): el requestAnimationFrame reescribe el interior del svg por su ref. Un
 * `setState` por cuadro es una actualización Default que interrumpe, cuadro tras cuadro, el render de reintento de
 * Suspense (carril Retry, de menor prioridad); si el módulo perezoso no cabía en un cuadro, nunca terminaba de
 * montar. Este componente renderiza una sola vez y no tiene estado.
 */
export function IsotipoCarga({
  modo = "carga",
  detenido = false,
  fondo = "var(--module-accent, var(--pulso-primary))",
  className,
}: {
  modo?: "carga" | "firma";
  detenido?: boolean;
  fondo?: string;
  className?: string;
}) {
  const crudo = useId();
  const id = "trz" + crudo.replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const quieto = useMemo(() => marcadoTrenza(id), [id]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || detenido) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const dt = ahora - inicio;
      if (modo === "firma") {
        const pose = poseFirma(dt);
        if (pose.termino) { svg.innerHTML = quieto; return; }
        svg.innerHTML = marcadoTrenza(id, { m: pose.m, om: pose.om, pasos: 150, paradas: 7 });
      } else {
        const pose = poseConEntrada(dt);
        svg.innerHTML = marcadoTrenza(id, { m: pose.m, om: pose.om, pasos: 150, paradas: 7 });
      }
      raf = window.requestAnimationFrame(paso);
    };
    raf = window.requestAnimationFrame(paso);
    return () => {
      window.cancelAnimationFrame(raf);
      svg.innerHTML = quieto;
    };
  }, [detenido, modo, id, quieto]);

  return (
    <span className={["pulso-isotipo-carga", detenido ? "is-detenido" : null, className].filter(Boolean).join(" ")} aria-hidden="true">
      <svg
        ref={svgRef}
        className="pulso-isotipo"
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
        style={{ "--isotipo-fondo": fondo, "--isotipo-tinta": "#fff" } as CSSProperties}
        dangerouslySetInnerHTML={{ __html: quieto }}
      />
    </span>
  );
}
