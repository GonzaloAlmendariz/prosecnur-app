// La frase de cada filtro sale del motor de lectura (reglas/leerRegla, columna choice_filter), nunca de una redacción
// propia. El filtro fijo lleva además la cuenta de opciones y la fila rota su aviso, que ya arma buildChoiceFilterModel.

import type { BuilderStructure } from "../types";
import { leerRegla } from "../reglas/leerRegla";
import { separarAviso } from "../reglas/motor";
import { textoDePiezas, type Pieza } from "../reglas/piezas";
import { alcanceDelModelo, buildChoiceFilterModel } from "./buildChoiceFilterModel";

export type FraseFiltro = {
  /** Piezas del motor (preguntas y opciones como chips), sin el punto final. null si la frase es un texto armado o el
   *  motor no la lee. */
  piezas: Pieza[] | null;
  /** La misma frase en texto plano (lista, tooltip, lector de pantalla). */
  texto: string;
  /** El motor no sabe leerla: se muestra la expresión. */
  tecnica: boolean;
  aviso: string | null;
};

export function frasesDeFiltros(structure: BuilderStructure | null, columnas: string[], filas: string[][]): Map<number, FraseFiltro> {
  const out = new Map<number, FraseFiltro>();
  if (!structure) return out;
  const { cards } = buildChoiceFilterModel({ structure, choicesColumns: columnas, choicesRows: filas });
  let alcance: ReturnType<typeof alcanceDelModelo> | null = null;
  for (const card of cards) {
    if (card.clase === "fijo" || card.clase === "rota") {
      out.set(card.rowIndex, { piezas: null, texto: card.explanation, tecnica: false, aviso: card.aviso ?? null });
      continue;
    }
    const nodo = structure.byRow.get(card.rowIndex);
    if (!nodo) continue;
    alcance ??= alcanceDelModelo(structure, columnas, filas);
    const lectura = leerRegla("choice_filter", card.rawExpression, nodo, alcance);
    if (lectura.tecnica || !lectura.piezas.length) {
      out.set(card.rowIndex, { piezas: null, texto: "El editor no sabe leer este filtro.", tecnica: true, aviso: null });
      continue;
    }
    const { piezas, aviso } = separarAviso(lectura.piezas);
    const conPunto: Pieza[] = [...piezas, { tipo: "texto", texto: "." }];
    out.set(card.rowIndex, { piezas, texto: textoDePiezas(conPunto), tecnica: false, aviso });
  }
  return out;
}
