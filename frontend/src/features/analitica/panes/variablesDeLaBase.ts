// Variables de la base activa para Ponderación (F7 de la prueba real de la
// matriz HSyVbG). Con 409 columnas `/api/analitica/variables` tarda ~60 s y,
// mientras tanto, «Usar una columna» afirmaba «Esta base no tiene columnas
// numéricas»: un vacío dicho sin haber medido (C3/C5). Además, la lista se
// pedía una sola vez y quedaba la de la base anterior al cambiar de base.
//
// Aquí la lectura tiene tres estados y se vuelve a pedir con cada cambio de
// base activa (`pulso:active-base-changed`). Una respuesta que llega tarde,
// de una base que ya no es la activa, se descarta.

import { useEffect, useRef, useState } from "react";
import { apiAnaliticaVariables } from "../../../api/analitica";
import type { VariableInstrumento } from "../../../api/client";

export type LecturaVariables =
  | { tipo: "cargando" }
  | { tipo: "lista"; variables: VariableInstrumento[] }
  | { tipo: "error"; mensaje: string };

export const EVENTO_BASE_ACTIVA = "pulso:active-base-changed";

/**
 * Pide las variables y publica su lectura. Cada `pedir` invalida a los
 * anteriores: sólo la última respuesta publica. Pedir otra vez la MISMA base
 * mientras su lectura sigue en vuelo no duplica la llamada (el cambio de base
 * llega a la vez por la sesión y por el evento, y cada llamada cuesta ~60 s);
 * sin `base`, o con la lectura terminada, se pide de nuevo. `cerrar` descarta
 * todo lo que esté en vuelo.
 */
export function crearLectorDeVariables(
  pedirVariables: () => Promise<VariableInstrumento[]>,
  publicar: (lectura: LecturaVariables) => void,
): { pedir: (base?: string | null) => void; cerrar: () => void } {
  let vigente = 0;
  let cerrado = false;
  let enVuelo: { turno: number; base: string | null | undefined } | null = null;
  return {
    pedir(base) {
      if (cerrado) return;
      if (enVuelo && base !== undefined && enVuelo.base === base) return;
      vigente += 1;
      const turno = vigente;
      enVuelo = { turno, base };
      publicar({ tipo: "cargando" });
      const terminar = (lectura: LecturaVariables) => {
        if (cerrado || turno !== vigente) return;
        enVuelo = null;
        publicar(lectura);
      };
      pedirVariables().then(
        (variables) => terminar({ tipo: "lista", variables }),
        (e: unknown) => terminar({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) }),
      );
    },
    cerrar() {
      cerrado = true;
    },
  };
}

/** Las variables de la lectura; mientras carga o tras un error, ninguna. */
export function variablesDeLectura(lectura: LecturaVariables): VariableInstrumento[] {
  return lectura.tipo === "lista" ? lectura.variables : [];
}

function baseDelEvento(e: Event): string | undefined {
  const detalle: unknown = e instanceof CustomEvent ? e.detail : null;
  if (typeof detalle !== "object" || detalle === null || !("active" in detalle)) return undefined;
  const activa = (detalle as { active?: unknown }).active;
  return typeof activa === "string" && activa ? activa : undefined;
}

/**
 * Lectura de las variables de la base activa. Se pide al montar, cuando cambia
 * `baseActiva` y cuando se emite el cambio de base.
 */
export function useVariablesDeLaBase(baseActiva: string | null): LecturaVariables {
  const [lectura, setLectura] = useState<LecturaVariables>({ tipo: "cargando" });
  const lector = useRef<ReturnType<typeof crearLectorDeVariables> | null>(null);
  useEffect(() => {
    const l = crearLectorDeVariables(async () => (await apiAnaliticaVariables()).variables, setLectura);
    lector.current = l;
    const alCambiar = (e: Event) => l.pedir(baseDelEvento(e));
    window.addEventListener(EVENTO_BASE_ACTIVA, alCambiar);
    return () => {
      l.cerrar();
      lector.current = null;
      window.removeEventListener(EVENTO_BASE_ACTIVA, alCambiar);
    };
  }, []);
  useEffect(() => {
    lector.current?.pedir(baseActiva);
  }, [baseActiva]);
  return lectura;
}
