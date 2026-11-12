import type { TipoDePregunta } from "../../../../components/procesamiento/FichaPregunta";
import type { ExploradorVariable } from "../../types";

/** El color de una pregunta en el panel (tokens `--tipo-*`): opción única, múltiple, número o texto. */
export function tipoDeFicha(tipo: ExploradorVariable["tipo"] | undefined): TipoDePregunta {
  if (tipo === "so") return "unica";
  if (tipo === "sm") return "multiple";
  if (tipo === "num" || tipo === "fecha") return "numerica";
  return "texto";
}

/** ¿La pregunta tiene una lista de opciones que se puede leer por etiqueta? */
export function tieneOpciones(tipo: ExploradorVariable["tipo"] | undefined): boolean {
  return tipo === "so" || tipo === "sm";
}
