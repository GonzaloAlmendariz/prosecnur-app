// P20: carga la matriz de equivalencias una sola vez por builder (ADR 0104: sólo sus filas confirmadas sugieren). Es una ayuda, no un
// requisito: sin matriz, sin bases separadas o con error, devuelve fuentes vacías y no dice nada.

import { useEffect, useState } from "react";
import { getEquivalencias } from "../../../api/equivalencias";
import { useSession } from "../../../lib/SessionContext";
import { fuentesDeMatriz, SIN_MATRIZ, type FuentesMatriz } from "./sugerenciasMatriz";

export function useSugerenciasDeMatriz(activo: boolean): FuentesMatriz {
  const { sessionId } = useSession();
  const [fuentes, setFuentes] = useState<FuentesMatriz>(SIN_MATRIZ);
  useEffect(() => {
    if (!activo || !sessionId) {
      setFuentes(SIN_MATRIZ);
      return;
    }
    let vigente = true;
    void (async () => {
      const estado = await getEquivalencias().catch(() => null);
      if (!vigente) return;
      if (!estado?.disponible) {
        setFuentes(SIN_MATRIZ);
        return;
      }
      const filas = estado.filas ?? [];
      setFuentes(filas.length ? fuentesDeMatriz(filas) : SIN_MATRIZ);
    })();
    return () => {
      vigente = false;
    };
  }, [activo, sessionId]);
  return fuentes;
}
