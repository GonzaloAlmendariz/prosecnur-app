// =============================================================================
// cuestionario/modeloFicha.ts — la ficha de solo lectura de una pregunta
// =============================================================================
// En «Vista del cuestionario» el clic en una pregunta despliega su ficha bajo
// ella (ítem 50): tipo, variable, obligatoriedad, condición en lenguaje llano,
// lista de opciones y restricción. Nada de esto navega; la única salida al
// Constructor es «Editar en Constructor».
// =============================================================================

import { typeLabel } from "../parsing/parseType";
import type { OpcionDoc, PreguntaDoc } from "./modeloCuestionario";

export type FichaPregunta = {
  numero: number;
  variable: string;
  tipo: string;
  obligatoria: boolean;
  /** «Aparece si …» en lenguaje llano; null si aparece siempre. */
  condicion: string | null;
  lista: { nombre: string; opciones: readonly OpcionDoc[] } | null;
  /** La restricción en una frase (un rango) o, si no se reconoce, la regla tal cual. */
  restriccion: { texto: string; tecnica: boolean } | null;
  mensajeRestriccion: string | null;
};

export function textoRango(rango: NonNullable<PreguntaDoc["rango"]>): string {
  if (rango.min && rango.max) return `entre ${rango.min} y ${rango.max}`;
  return rango.min ? `desde ${rango.min}` : `hasta ${rango.max}`;
}

export function fichaDePregunta(pregunta: PreguntaDoc): FichaPregunta {
  const { nodo } = pregunta;
  const regla = nodo.constraint.trim();
  const restriccion = !regla
    ? null
    : pregunta.rango
      ? { texto: `El valor va ${textoRango(pregunta.rango)}.`, tecnica: false }
      : { texto: regla, tecnica: true };
  const listName = nodo.typeInfo.listName.trim();
  return {
    numero: pregunta.numero,
    variable: nodo.name,
    tipo: typeLabel(nodo.typeInfo.base),
    obligatoria: nodo.required,
    condicion: pregunta.condicion,
    lista: listName ? { nombre: listName, opciones: pregunta.opciones } : null,
    restriccion,
    mensajeRestriccion: nodo.constraint_message?.trim() || null,
  };
}
