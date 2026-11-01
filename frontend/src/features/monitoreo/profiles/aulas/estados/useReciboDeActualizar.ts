import { useCallback, useRef, useState } from "react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";

/**
 * P1 · Actualizar explica su proceso (aulas.md, G3). Toma las cifras de antes
 * y de después, el tiempo y si la descarga de la plataforma falló, para que el
 * recibo diga qué cambió y qué no se tocó. No interviene en el sync: sólo lo
 * mide desde fuera.
 */

export type Cifras = { efectivas: number | null; porResolver: number | null; partes: number };

export type ReciboDeActualizar = {
  pasos: Array<{ clave: string; rotulo: string; detalle: string; tono: "ok" | "aviso" }>;
  cambios: Array<{ rotulo: string; antes: number | null; despues: number | null }>;
  segundos: number;
};

function n(v: unknown): number | null {
  const x = typeof v === "number" ? v : Number(v);
  return v == null || !Number.isFinite(x) ? null : x;
}

export function cifrasDe(d: MonitoreoAulasDashboard | null): Cifras {
  const diseno = ((d?.refuerzos as { diseno?: { sin_resolver?: unknown } } | null)?.diseno) ?? null;
  return {
    efectivas: n((d?.avance_cuota?.total as { respuestas_validas?: unknown } | undefined)?.respuestas_validas),
    porResolver: n(diseno?.sin_resolver),
    partes: (d?.partes_campo ?? []).length,
  };
}

export function construirRecibo(antes: Cifras, despues: Cifras, segundos: number, fuentes: number, avisoDescarga: string): ReciboDeActualizar {
  return {
    pasos: [
      {
        clave: "traer",
        rotulo: "Traer lo nuevo",
        detalle: !fuentes
          ? "Sin fuentes activas: no se pidió nada a la plataforma."
          : avisoDescarga ? `La plataforma no respondió (${avisoDescarga}); se recalculó con lo que ya había.` : "Respuestas nuevas de la plataforma y el libro del operativo.",
        tono: avisoDescarga ? "aviso" : "ok",
      },
      { clave: "recalcular", rotulo: "Recalcular", detalle: `Tablero de cursos-horario en ${segundos.toFixed(1)} s.`, tono: "ok" },
      { clave: "recibo", rotulo: "Dejar recibo", detalle: "Lo que cambió en este corte.", tono: "ok" },
    ],
    cambios: [
      { rotulo: "Efectivas que cuentan", antes: antes.efectivas, despues: despues.efectivas },
      { rotulo: "Titulares por resolver", antes: antes.porResolver, despues: despues.porResolver },
      { rotulo: "Partes de campo", antes: antes.partes, despues: despues.partes },
    ],
    segundos,
  };
}

export function useReciboDeActualizar() {
  const inicio = useRef<{ cifras: Cifras; t: number } | null>(null);
  const [recibo, setRecibo] = useState<ReciboDeActualizar | null>(null);
  const empezar = useCallback((d: MonitoreoAulasDashboard | null) => {
    inicio.current = { cifras: cifrasDe(d), t: Date.now() };
    setRecibo(null);
  }, []);
  const terminar = useCallback((d: MonitoreoAulasDashboard | null, fuentes: number, avisoDescarga: string) => {
    const i = inicio.current;
    if (!i) return;
    setRecibo(construirRecibo(i.cifras, cifrasDe(d), (Date.now() - i.t) / 1000, fuentes, avisoDescarga));
    inicio.current = null;
  }, []);
  const cerrar = useCallback(() => setRecibo(null), []);
  return { recibo, empezar, terminar, cerrar };
}
