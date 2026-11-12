// El avance de cada pregunta (`avanceDeCodificacion`), compartido por Preguntas, Codificar y Aplicar para
// que las tres digan lo mismo. Estado de la vista: se arma leyendo las respuestas de cada pregunta con
// códigos y lo actualiza la mesa de Codificar con cada cambio. Se vacía al cambiar de base.

import { useEffect } from "react";
import { create } from "zustand";
import { apiCodifRespuestas, type Grupo, type PreguntaAbierta } from "../../api/codificacion";
import { avanceDeCodificacion, type AvanceDeCodificacion } from "./avanceDeCodificacion";
import { armarUnidades, fuenteDeRespuestas, tieneTexto, type Unidad } from "./preguntas/modeloUnidades";

export type AvanceDePregunta = { avance: AvanceDeCodificacion; grupos: readonly Grupo[] | null };

type EstadoAvances = {
  porPregunta: Record<string, AvanceDePregunta>;
  poner: (parent: string, dato: AvanceDePregunta) => void;
  vaciar: () => void;
};

export const useAvances = create<EstadoAvances>((set) => ({
  porPregunta: {},
  poner: (parent, dato) => set((s) => ({ porPregunta: { ...s.porPregunta, [parent]: dato } })),
  vaciar: () => set({ porPregunta: {} }),
}));

/** Las unidades cuyo avance se muestra: las que tienen texto y entran o ya tienen códigos (no las numéricas). */
export function unidadesConAvance(unidades: readonly Unidad[]): Unidad[] {
  return unidades.filter(
    (u) =>
      tieneTexto(u) &&
      u.arquetipo !== "no-aplica" &&
      u.principal.tipo !== "integer" &&
      (u.principal.marcada || u.principal.marcada_auto || (u.principal.n_codificadas ?? 0) > 0),
  );
}

/**
 * Llena el avance de las preguntas que faltan. Una sin códigos no se lee: su avance es cero sobre sus
 * respuestas. Una con códigos se lee una vez (`/api/codificacion/respuestas`).
 */
export function useCargarAvances(preguntas: readonly PreguntaAbierta[] | null) {
  useEffect(() => {
    if (!preguntas) return undefined;
    let vivo = true;
    const { porPregunta, poner } = useAvances.getState();
    const pendientes = unidadesConAvance(armarUnidades(preguntas)).filter((u) => !porPregunta[u.principal.parent]);
    (async () => {
      for (const u of pendientes) {
        if (!vivo) return;
        const parent = u.principal.parent;
        if ((u.principal.n_codificadas ?? 0) === 0) {
          const fuente = fuenteDeRespuestas(u);
          poner(parent, {
            avance: { casosConCodigo: 0, casos: Math.max(0, fuente?.n_respuestas ?? 0), textosConCodigo: 0, textos: Math.max(0, fuente?.n_unicas ?? 0) },
            grupos: null,
          });
          continue;
        }
        try {
          const r = await apiCodifRespuestas(parent);
          if (vivo) poner(parent, { avance: avanceDeCodificacion(r.respuestas ?? [], r.grupos ?? []), grupos: r.grupos ?? [] });
        } catch {
          // Sin la lectura no se dice avance: la fila va sin anillo ni porcentaje.
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [preguntas]);
}
