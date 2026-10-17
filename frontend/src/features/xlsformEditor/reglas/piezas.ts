// Contrato entre el motor de reglas y la UI (2026-10-17, trabajo conjunto «señales + motor»).
// CONGELADO: lo escribe el lead; el motor implementa `leerRegla` (leerRegla.ts) y la UI (riel, panel, listas) sólo
// consume estos tipos. Cambiar una forma aquí exige acuerdo de los dos frentes.
//
// La lectura de una regla es una frase en PIEZAS, no una cadena: la UI pinta cada pregunta y cada opción como chip y
// el texto entre ellas tal cual. Así una etiqueta larga («1. Are you a citizen of ${countryname} ?») nunca se mezcla
// con los operadores, y la UI no tiene que buscar etiquetas dentro de un texto.

export type ColumnaRegla = "relevant" | "constraint" | "calculation" | "choice_filter" | "required";

export type Pieza =
  /** Texto de unión, ya redactado en español: «es», «y», «no acepta fechas posteriores a», «por». */
  | { tipo: "texto"; texto: string }
  /** Una pregunta del formulario. `etiqueta` es la etiqueta tal como está (la UI la acorta); `name` el código. */
  | { tipo: "pregunta"; name: string; etiqueta: string }
  /** Una opción de una lista. `etiqueta` es la visible («Sí»); `valor` el código («1»). */
  | { tipo: "opcion"; lista: string; valor: string; etiqueta: string }
  /** Un valor literal ya formateado para leer: «18», «hoy», «1 de enero de 2026», «9 caracteres». */
  | { tipo: "valor"; texto: string };

export type LecturaRegla = {
  columna: ColumnaRegla;
  /** La expresión original. */
  raw: string;
  /** La frase. Vacía sólo si `tecnica`. */
  piezas: Pieza[];
  /** El motor no sabe traducirla: la UI lo dice y muestra el código. Nunca se rellena con una frase inventada. */
  tecnica: boolean;
  /** Preguntas de las que depende, en orden de aparición, sin repetir. Se llena SIEMPRE (también si es técnica). */
  depende: { name: string; etiqueta: string }[];
  /** Sólo en choice_filter: la lista cuyas opciones se filtran. */
  lista?: string;
};

/** La frase como texto plano, para los sitios que todavía esperan una cadena (títulos, aria-label, impreso). */
export function textoDePiezas(piezas: readonly Pieza[]): string {
  return piezas
    .map((p) => (p.tipo === "texto" || p.tipo === "valor" ? p.texto : p.etiqueta))
    .join(" ")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ")
    .trim();
}
