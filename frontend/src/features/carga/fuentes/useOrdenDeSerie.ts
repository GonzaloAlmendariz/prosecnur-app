// Orden de la serie declarado en Equivalencias, para que Fuentes liste las bases
// en ese orden (M6 de la ronda de pulido): Fuentes mostraba b2026, b2024, b2025
// —orden de alta— mientras Equivalencias y Comparativos usan b2024, b2025, b2026.
//
// Es una lectura de cortesía: si el estudio aún no declara equivalencias o la
// lectura falla, Fuentes conserva el orden de alta y no muestra error, porque el
// orden no es un dato que Fuentes administre.

import { useEffect, useState } from "react";
import { getEquivalencias } from "../../../api/equivalencias";

export function useOrdenDeSerie(claveBases: string): string[] {
  const [periodos, setPeriodos] = useState<string[]>([]);
  useEffect(() => {
    let vigente = true;
    getEquivalencias()
      .then((est) => {
        if (vigente) setPeriodos(est.armonizacion_periodos ?? []);
      })
      .catch(() => {
        // Sin declaración legible se queda el orden de alta (ver cabecera).
        if (vigente) setPeriodos([]);
      });
    return () => {
      vigente = false;
    };
  }, [claveBases]);
  return periodos;
}
