import { useEffect, useState } from "react";
import { relojWarmup, type WarmupEstimacion } from "./warmupTiempo";
import "./warmup-reloj.css";

/** `Date.now()` que avanza cada segundo mientras `activo`; quieto si no. */
export function useAhora(activo: boolean, pasoMs = 1000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return undefined;
    setAhora(Date.now());
    const timer = window.setInterval(() => setAhora(Date.now()), pasoMs);
    return () => window.clearInterval(timer);
  }, [activo, pasoMs]);
  return ahora;
}

/**
 * Tiempo del warm start (L23): transcurrido siempre, restante sólo cuando hay
 * una apertura anterior con qué estimarlo. No se anuncia en vivo: un reloj que
 * cambia cada segundo dentro de un `role="status"` sería ruido para un lector
 * de pantalla; el titular de la fase ya se anuncia.
 */
export function WarmupReloj({
  transcurridoMs,
  estimacion,
  className,
}: {
  transcurridoMs: number;
  estimacion: WarmupEstimacion;
  className?: string;
}) {
  const reloj = relojWarmup(estimacion, transcurridoMs);
  return (
    <dl className={["pulso-warmup-reloj", className].filter(Boolean).join(" ")} aria-live="off">
      <div className="pulso-warmup-reloj-item is-transcurrido">
        <dt>Transcurrido</dt>
        <dd data-warmup-transcurrido="">{reloj.transcurrido}</dd>
      </div>
      {reloj.restante ? (
        <div className="pulso-warmup-reloj-item is-restante">
          <dt>Restante</dt>
          <dd data-warmup-restante="">{reloj.restante}</dd>
        </div>
      ) : null}
      {reloj.anterior ? (
        <div className="pulso-warmup-reloj-item is-anterior">
          <dt>Apertura anterior</dt>
          <dd>{reloj.anterior}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export default WarmupReloj;
