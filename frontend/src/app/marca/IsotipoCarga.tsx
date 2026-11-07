import { useEffect, useState } from "react";
import { IsotipoTrenza } from "./IsotipoTrenza";
import { poseConEntrada, poseFirma } from "./trenzaGeometria";


/**
 * El isotipo como indicador de espera (ADR 0132; reemplaza al «Ecualizador» que latía). Nunca desaparece:
 *  - `carga` (por defecto): los siete hilos se tuercen al montar y la cuerda queda girando sin corte mientras dure
 *    la espera, con una respiración suave. Es el de la carga del proyecto, la carga de módulo y el bloque de carga.
 *  - `firma`: la misma entrada, que se asienta en la pose quieta y se detiene (selector de proyecto).
 * Con movimiento reducido o `detenido` (error) queda en la pose del logo. El contenedor toma `fondo`: por defecto el
 * tono del módulo cuando lo hay y el navy de marca en el resto.
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
  const [t, setT] = useState<number | null>(null);

  useEffect(() => {
    if (detenido) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const dt = ahora - inicio;
      setT(dt);
      if (modo === "firma" && poseFirma(dt).termino) { setT(null); return; }
      raf = window.requestAnimationFrame(paso);
    };
    raf = window.requestAnimationFrame(paso);
    return () => window.cancelAnimationFrame(raf);
  }, [detenido, modo]);

  const enMovimiento = t !== null && !detenido;
  const pose = !enMovimiento ? { m: 1, om: 0 } : modo === "firma" ? poseFirma(t) : poseConEntrada(t);
  return (
    <span className={["pulso-isotipo-carga", detenido ? "is-detenido" : null, className].filter(Boolean).join(" ")} aria-hidden="true">
      <IsotipoTrenza
        fondo={fondo}
        m={pose.m}
        om={pose.om}
        pasos={enMovimiento ? 150 : undefined}
        paradas={enMovimiento ? 7 : undefined}
      />
    </span>
  );
}

