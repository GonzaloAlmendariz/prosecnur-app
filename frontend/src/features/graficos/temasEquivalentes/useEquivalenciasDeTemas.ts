// P21: lo que la matriz de equivalencias sabe para armar temas entre públicos —sus filas (para sugerir), sus bases y el
// orden declarado de la serie (`armonizacion_periodos`)—. `useSugerenciasDeMatriz` descarta el estado; la serie necesita
// el orden, así que este hook lo conserva. Es una ayuda: sin matriz o con error devuelve vacío y no dice nada.

import { useEffect, useState } from "react";
import { getEquivalencias, getSugerenciasEquivalencias } from "../../../api/equivalencias";
import { useSession } from "../../../lib/SessionContext";
import { fuentesDeMatriz, SIN_MATRIZ, type FuentesMatriz } from "../multiapiladas/sugerenciasMatriz";

export type EquivalenciasDeTemas = {
  matriz: FuentesMatriz;
  /** Bases que la matriz conoce (vacío: el estudio no tiene bases separadas o la matriz no respondió). */
  bases: string[];
  /** Orden declarado de las mediciones; se combina con las bases en `ordenEfectivo`. */
  periodos: string[];
};

const VACIO: EquivalenciasDeTemas = { matriz: SIN_MATRIZ, bases: [], periodos: [] };

export function useEquivalenciasDeTemas(activo: boolean): EquivalenciasDeTemas {
  const { sessionId } = useSession();
  const [estado, setEstado] = useState<EquivalenciasDeTemas>(VACIO);
  useEffect(() => {
    if (!activo || !sessionId) {
      setEstado(VACIO);
      return;
    }
    let vigente = true;
    void (async () => {
      const eq = await getEquivalencias().catch(() => null);
      if (!vigente) return;
      if (!eq?.disponible) {
        setEstado(VACIO);
        return;
      }
      // La propuesta automática sólo se pide si el estudio admite matriz: fuera de eso el backend responde 409.
      const propuesta = await getSugerenciasEquivalencias().catch(() => null);
      if (!vigente) return;
      const filas = eq.filas ?? [];
      const auto = Array.isArray(propuesta?.sugerencias) ? propuesta.sugerencias : [];
      setEstado({
        matriz: filas.length || auto.length ? fuentesDeMatriz(filas, auto) : SIN_MATRIZ,
        bases: eq.bases ?? [],
        periodos: eq.armonizacion_periodos ?? [],
      });
    })();
    return () => {
      vigente = false;
    };
  }, [activo, sessionId]);
  return estado;
}
