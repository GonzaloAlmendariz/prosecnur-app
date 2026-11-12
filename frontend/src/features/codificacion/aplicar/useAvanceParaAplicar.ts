// El avance de cada pregunta para Aplicar ("Lista" o "Faltan N" respuestas): el mismo que ven Preguntas y
// Codificar (`avanceStore.ts`, leído de las respuestas que la base trae hoy). `listo` dice cuándo ya se
// sabe el de todas las preguntas que se aplican: hasta entonces la pantalla no se declara lista.

import { useEffect, useState } from "react";
import { apiCodifPreguntasAbiertas, type PreguntaAbierta } from "../../../api/codificacion";
import { useAvances, useCargarAvances } from "../avanceStore";
import type { AvanceParaAplicar } from "./gruposDeAplicar";

export type AvancesParaAplicar = { listo: boolean; mapa: ReadonlyMap<string, AvanceParaAplicar> | null };

export function useAvanceParaAplicar(version: unknown, aplicables: readonly string[]): AvancesParaAplicar {
  const [lectura, setLectura] = useState<{ preguntas: PreguntaAbierta[] | null; fallo: boolean }>({ preguntas: null, fallo: false });
  useEffect(() => {
    let vivo = true;
    apiCodifPreguntasAbiertas().then(
      (r) => {
        if (vivo) setLectura({ preguntas: r.preguntas ?? [], fallo: false });
      },
      () => {
        if (vivo) setLectura({ preguntas: null, fallo: true });
      },
    );
    return () => {
      vivo = false;
    };
  }, [version]);
  useCargarAvances(lectura.preguntas);
  const porPregunta = useAvances((s) => s.porPregunta);
  // Sin la lista de preguntas no se dice estado (la lista va sin grupos), pero la pantalla sí queda lista.
  if (lectura.fallo) return { listo: true, mapa: null };
  if (!lectura.preguntas) return { listo: false, mapa: null };
  const mapa = new Map<string, AvanceParaAplicar>();
  for (const [parent, dato] of Object.entries(porPregunta)) mapa.set(parent, { decididas: dato.avance.casosConCodigo, total: dato.avance.casos });
  return { listo: aplicables.every((p) => mapa.has(p)), mapa };
}
