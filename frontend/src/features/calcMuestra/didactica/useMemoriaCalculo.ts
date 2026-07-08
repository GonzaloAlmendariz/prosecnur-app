/**
 * Fuente única de verdad del cálculo interactivo.
 *
 * Ante cada cambio de parámetros pinta al instante una vista previa TS
 * (`motorPreview`, etiquetada como preview) y consulta debounced al motor R
 * (`POST /api/calc-muestra/explicar`). Cuando el motor responde, la memoria
 * validada reemplaza a la vista previa y el badge pasa a "motor R".
 */
import { useEffect, useRef, useState } from "react";
import {
  apiCalcMuestraExplicar,
  type CalcMuestraExplicarInput,
  type CalcMuestraMemoria,
} from "../../../api/client";
import { calcEPreview, calcNPreview, zFromConfidence } from "./motorPreview";

export type MemoriaEstado = "validado" | "preview" | "error";

export type MemoriaCalculo = {
  estado: MemoriaEstado;
  /** Memoria validada del motor R (null hasta la primera respuesta). */
  memoria: CalcMuestraMemoria | null;
  /** Vista previa optimista TS para pintar sin esperar al motor. */
  preview: {
    z: number;
    nTeorico: number | null;
    nObjetivo: number | null;
    nOperativo: number | null;
    sobremuestra: number;
    precision: number | null;
  };
};

const DEBOUNCE_MS = 250;

export function useMemoriaCalculo(input: CalcMuestraExplicarInput | null): MemoriaCalculo {
  const [memoria, setMemoria] = useState<CalcMuestraMemoria | null>(null);
  const [estado, setEstado] = useState<MemoriaEstado>("preview");
  const requestSeq = useRef(0);
  const inputKey = input ? JSON.stringify(input) : "";

  useEffect(() => {
    if (!input || !(input.N > 0)) return;
    setEstado("preview");
    const seq = ++requestSeq.current;
    const timer = window.setTimeout(() => {
      apiCalcMuestraExplicar(input)
        .then((res) => {
          if (requestSeq.current !== seq) return;
          setMemoria(res.memoria);
          setEstado("validado");
        })
        .catch(() => {
          if (requestSeq.current !== seq) return;
          setEstado("error");
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  const z = input?.z ?? zFromConfidence(input?.confianza ?? 0.95);
  const nTeorico = input
    ? calcNPreview(input.N, input.p ?? 0.5, z, input.e ?? 0.05, input.deff ?? 1)
    : null;
  const nObjetivo = input?.meta_valor && input.meta_valor > 0
    ? Math.ceil(input.meta_valor)
    : nTeorico;
  const sobremuestra = nObjetivo != null ? Math.ceil(nObjetivo * (input?.oversample_pct ?? 0)) : 0;
  const precision = input && nObjetivo != null
    ? calcEPreview(nObjetivo, input.N, input.p ?? 0.5, z, input.deff ?? 1)
    : null;

  return {
    estado,
    // Puede quedar la memoria previa mientras estado === "preview"; los
    // consumidores deciden por `estado` qué cifra pintar.
    memoria,
    preview: {
      z,
      nTeorico,
      nObjetivo,
      nOperativo: nObjetivo != null ? nObjetivo + sobremuestra : null,
      sobremuestra,
      precision,
    },
  };
}
