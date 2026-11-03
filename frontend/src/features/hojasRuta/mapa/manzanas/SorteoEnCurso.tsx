import { useEffect, useState } from "react";

/** «1:05»: minutos y segundos desde `desde` hasta `ahora`. */
export function transcurrido(desde: number, ahora: number): string {
  const s = Math.max(0, Math.floor((ahora - desde) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Revisión con ojo de usuario (1 nov 2026): con el marco completo el sorteo tarda minutos y la única
 * señal era el botón «Sorteando…». El pedido no informa avance (no es un job), así que se dice lo que
 * es verdad: cuánto lleva, cuánto suele tardar y que el mapa sigue disponible.
 */
export function SorteoEnCurso({ desde, distritos }: { desde: number; distritos: number }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <p className="hr-mapa-nota" role="status" aria-live="polite">
      Sorteando {distritos === 1 ? "1 distrito" : `${distritos} distritos`}, lleva {transcurrido(desde, ahora)}. Con el marco completo suele tardar
      entre 1 y 5 minutos; mientras tanto puedes seguir mirando el mapa.
    </p>
  );
}
