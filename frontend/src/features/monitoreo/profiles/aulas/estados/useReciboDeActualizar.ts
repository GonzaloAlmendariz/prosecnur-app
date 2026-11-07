import { formatoDecimal } from "../../../../../lib/formatoNumero";
import { useCallback, useEffect, useRef, useState } from "react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";

/**
 * P1 · Actualizar explica su proceso (aulas.md, G3), en tres momentos:
 * abierto (P1a: qué va a leer y qué no toca, antes de empezar), corriendo
 * (P1b: en qué paso va y cuánto lleva) y recibo (P1c: qué cambió). Mide el
 * sync desde fuera: no cambia lo que hace.
 */

export type Cifras = { efectivas: number | null; porResolver: number | null; partes: number };

export type PasoDeActualizar = "traer" | "recalcular" | "recibo";

export type ReciboDeActualizar = {
  pasos: Array<{ clave: string; rotulo: string; detalle: string; tono: "ok" | "aviso" }>;
  cambios: Array<{ rotulo: string; antes: number | null; despues: number | null }>;
  segundos: number;
};

export type EstadoDeActualizar =
  | { momento: "cerrado" }
  | { momento: "abierto" }
  | { momento: "corriendo"; paso: PasoDeActualizar; segundos: number; leyendo: boolean }
  | { momento: "recibo"; recibo: ReciboDeActualizar };

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

export function construirRecibo(antes: Cifras, despues: Cifras, segundos: number, fuentes: number, avisoDescarga: string, leyo = true): ReciboDeActualizar {
  return {
    pasos: [
      {
        clave: "traer",
        rotulo: "Traer lo nuevo",
        detalle: !leyo
          ? "No se leyó nada: se pidió recalcular con lo que ya había."
          : !fuentes
            ? "Sin fuentes activas: no se pidió nada a la plataforma."
            : avisoDescarga ? `La plataforma no respondió (${avisoDescarga}); se recalculó con lo que ya había.` : "Respuestas nuevas de la plataforma y el libro del operativo.",
        tono: avisoDescarga ? "aviso" : "ok",
      },
      { clave: "recalcular", rotulo: "Recalcular", detalle: `Tablero de cursos-horario en ${formatoDecimal(segundos, 1)} s.`, tono: "ok" },
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
  const inicio = useRef<{ cifras: Cifras; t: number; leyendo: boolean } | null>(null);
  const [estado, setEstado] = useState<EstadoDeActualizar>({ momento: "cerrado" });

  // El reloj del paso en curso (P1b): un tic por segundo mientras corre.
  useEffect(() => {
    if (estado.momento !== "corriendo") return undefined;
    const id = window.setInterval(() => {
      const i = inicio.current;
      if (!i) return;
      setEstado((e) => (e.momento === "corriendo" ? { ...e, segundos: (Date.now() - i.t) / 1000 } : e));
    }, 1000);
    return () => window.clearInterval(id);
  }, [estado.momento]);

  const abrir = useCallback(() => setEstado({ momento: "abierto" }), []);
  const empezar = useCallback((d: MonitoreoAulasDashboard | null, leyendo = true) => {
    inicio.current = { cifras: cifrasDe(d), t: Date.now(), leyendo };
    setEstado({ momento: "corriendo", paso: leyendo ? "traer" : "recalcular", segundos: 0, leyendo });
  }, []);
  const paso = useCallback((p: PasoDeActualizar) => {
    setEstado((e) => (e.momento === "corriendo" ? { ...e, paso: p } : e));
  }, []);
  const terminar = useCallback((d: MonitoreoAulasDashboard | null, fuentes: number, avisoDescarga: string) => {
    const i = inicio.current;
    if (!i) return;
    setEstado({ momento: "recibo", recibo: construirRecibo(i.cifras, cifrasDe(d), (Date.now() - i.t) / 1000, fuentes, avisoDescarga, i.leyendo) });
    inicio.current = null;
  }, []);
  const cerrar = useCallback(() => { inicio.current = null; setEstado({ momento: "cerrado" }); }, []);
  return { estado, abrir, empezar, paso, terminar, cerrar };
}
