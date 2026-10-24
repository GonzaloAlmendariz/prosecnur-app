// Acción masiva del panel de avisos: «Fijar la base principal en todas las láminas» (fijarBase.ts, U1 de CCSS).
import { useMemo } from "react";
import { conBaseFijada } from "./fijarBase";
import { usePlanStore } from "./store";
import { useVariables } from "./useVariables";

export type FijarBase = { laminas: number; preguntas: number; base: string; fijar: () => void };

export function useFijarBase(): FijarBase | undefined {
  const slides = usePlanStore((s) => s.plan.slides);
  const transformar = usePlanStore((s) => s.transformarLaminas);
  const { variables, multi, relacionBases } = useVariables();
  return useMemo(() => {
    if (!multi) return undefined;
    const { laminas, preguntas, base } = conBaseFijada(slides, variables, relacionBases);
    if (!laminas || !base) return undefined;
    // Se recalcula contra el plan vigente al hacer clic: un solo paso deshacible; si ya no hay nada, no ensucia.
    const fijar = () => transformar((actuales) => {
      const r = conBaseFijada(actuales, variables, relacionBases);
      return r.laminas ? r.slides : actuales;
    });
    return { laminas, preguntas, base, fijar };
  }, [slides, variables, multi, relacionBases, transformar]);
}
