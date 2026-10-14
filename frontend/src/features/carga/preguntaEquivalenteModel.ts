/**
 * Editor directo de la matriz de equivalencias (ADR 0104).
 *
 * La persona arma cada fila: elige la pregunta de un público y, en cada uno de
 * los otros, busca la suya por su texto. Aquí vive lo que decide esa búsqueda
 * y lo que dice el indicador de escala de la fila; el render está en
 * `PreguntaCombobox.tsx` y `EquivalenciasTabla.tsx`.
 *
 * Nada de esto propone emparejamientos: la búsqueda filtra lo que la persona
 * escribe, y el indicador sólo compara las preguntas que ella ya eligió.
 */

import type { EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";
import { estadoArmonizacion, explicacionArmonizacion } from "./armonizacionModel";
import type { NombreDeSerie } from "./nombreDeSerie";

// ---- Búsqueda por texto -----------------------------------------------------

/** Minúsculas y sin tildes: «Satisfacción» y «satisfaccion» son la misma búsqueda. */
export function normalizarBusqueda(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

/**
 * Preguntas de una base que casan con lo escrito. Cada palabra de la consulta
 * tiene que aparecer en la etiqueta, el código o la sección, en cualquier orden:
 * «salud uso» encuentra «¿Ha usado el servicio de salud?». Sin consulta, todas
 * en el orden del instrumento.
 */
export function filtrarPreguntas(
  opciones: readonly VariableDeBase[],
  consulta: string,
): VariableDeBase[] {
  const palabras = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [...opciones];
  return opciones.filter((o) => {
    const texto = normalizarBusqueda(`${o.label} ${o.name} ${o.seccion}`);
    return palabras.every((p) => texto.includes(p));
  });
}

/** Lo que se lee de una pregunta elegida: su etiqueta, o el código si no tiene. */
export function etiquetaDePregunta(opciones: readonly VariableDeBase[], nombre: string): string {
  if (!nombre) return "";
  const v = opciones.find((o) => o.name === nombre);
  return v?.label.trim() || nombre;
}

// ---- Escala de la fila ------------------------------------------------------

export type CoincidenciaDeEscala =
  /** Menos de dos bases con pregunta: no hay nada que comparar todavía. */
  | { tipo: "incompleta" }
  /** Ninguna de las elegidas tiene lista de respuestas (abierta, numérica). */
  | { tipo: "sin_lista" }
  | { tipo: "misma" }
  /** `bases`: las que no usan la escala de la primera base elegida. */
  | { tipo: "distintas"; bases: string[] };

/**
 * Compara las escalas de las preguntas elegidas por su `firma` (códigos y
 * etiquetas de su lista, en orden; ADR 0064). Una pregunta sin firma frente a
 * otra con lista es una escala distinta, no una coincidencia.
 */
export function coincidenciaDeEscala(
  bases: readonly string[],
  variables: Record<string, string | undefined>,
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
): CoincidenciaDeEscala {
  const elegidas = bases
    .filter((b) => Boolean(variables[b]))
    .map((b) => ({
      base: b,
      firma: (variablesPorBase[b] ?? []).find((v) => v.name === variables[b])?.firma?.trim() ?? "",
    }));
  if (elegidas.length < 2) return { tipo: "incompleta" };
  if (elegidas.every((e) => !e.firma)) return { tipo: "sin_lista" };
  const referencia = elegidas[0].firma;
  const distintas = elegidas.filter((e) => e.firma !== referencia).map((e) => e.base);
  return distintas.length ? { tipo: "distintas", bases: distintas } : { tipo: "misma" };
}

export type IndicadorDeEscala = {
  /** Clase visual: `ok`, `aviso` o `neutro`. */
  tono: "ok" | "aviso" | "neutro";
  texto: string;
  /** Explicación en palabras llanas; va en el `title` del control. */
  explicacion: string;
  /** Si abre la armonización de la fila. Sin dos bases elegidas no hay qué armonizar. */
  abre: boolean;
};

/**
 * Lo que dice la columna «Escala» de una fila. Si la fila ya tiene una
 * armonización declarada, manda su estado («Armonizada», «No comparable en…»):
 * es una decisión de la persona y pesa más que la comparación de listas.
 */
export function indicadorDeEscala(
  fila: Pick<EquivalenciaFila, "armonizacion" | "variables">,
  bases: readonly string[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
  serie: NombreDeSerie,
): IndicadorDeEscala {
  const coincidencia = coincidenciaDeEscala(bases, fila.variables, variablesPorBase);
  if (coincidencia.tipo === "incompleta") {
    return {
      tono: "neutro",
      texto: "Falta otra base",
      explicacion: "Elige la pregunta equivalente en al menos otra base para comparar sus escalas.",
      abre: false,
    };
  }
  if (fila.armonizacion && fila.armonizacion.escala.length > 0) {
    const estado = estadoArmonizacion(fila);
    return {
      tono: estado.tipo === "armonizada" ? "ok" : "aviso",
      texto: estado.texto,
      explicacion: explicacionArmonizacion(estado, serie),
      abre: true,
    };
  }
  switch (coincidencia.tipo) {
    case "sin_lista":
      return {
        tono: "neutro",
        texto: "Sin lista de respuestas",
        explicacion: "Las preguntas elegidas no tienen opciones de respuesta que comparar (abiertas o numéricas).",
        abre: false,
      };
    case "misma":
      return {
        tono: "ok",
        texto: "Misma escala",
        explicacion: `Las bases elegidas usan la misma lista de respuestas. Para los comparativos entre ${serie.plural} de Analítica, ábrela y confírmala como armonizada.`,
        abre: true,
      };
    case "distintas":
      return {
        tono: "aviso",
        texto: "Escalas distintas · Armonizar",
        explicacion: `La lista de respuestas cambia en ${coincidencia.bases.join(", ")}. Armonizar es declarar qué respuesta de cada base es la misma.`,
        abre: true,
      };
  }
}
