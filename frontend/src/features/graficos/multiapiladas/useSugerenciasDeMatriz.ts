// P20: carga la matriz de equivalencias y la propuesta automática una sola vez por builder. Es una ayuda, no un
// requisito: sin matriz, sin bases separadas o con error, devuelve fuentes vacías y no dice nada.

import { useEffect, useState } from "react";
import { getEquivalencias, getSugerenciasEquivalencias } from "../../../api/equivalencias";
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
    // La propuesta automática sólo se pide si el estudio admite matriz: fuera de eso el backend responde 409.
    void (async () => {
      const estado = await getEquivalencias().catch(() => null);
      if (!vigente) return;
      if (!estado?.disponible) {
        setFuentes(SIN_MATRIZ);
        return;
      }
      const propuesta = await getSugerenciasEquivalencias().catch(() => null);
      if (!vigente) return;
      const filas = estado.filas ?? [];
      const auto = Array.isArray(propuesta?.sugerencias) ? propuesta.sugerencias : [];
      setFuentes(filas.length || auto.length ? fuentesDeMatriz(filas, auto) : SIN_MATRIZ);
    })();
    return () => {
      vigente = false;
    };
  }, [activo, sessionId]);
  return fuentes;
}
