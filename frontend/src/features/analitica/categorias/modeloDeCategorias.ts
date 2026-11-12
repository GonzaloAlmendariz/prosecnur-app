// Lógica pura de Analítica › Orden de categorías con la forma del prototipo
// ("Analítica, Categorías"): qué listas muestra el buscador, qué códigos
// especiales trae el estudio, las cifras de la cabecera, el interruptor
// "Especiales al final" y el movimiento con el teclado. Las secuencias y la
// ordinalidad efectiva siguen en `panes/ordenCategoriasModel.ts`, que es el
// contrato con el motor.

import type { DataReviewOption, DataReviewVariable, VariableInstrumento } from "../../../api/analitica";
import { textoPlano } from "../../../lib/textoPlano";
import {
  enviarEspecialesAlFinal,
  esValorEspecial,
  moverAbajo,
  moverAlFinal,
  moverAlInicio,
  moverArriba,
  ordenesIguales,
  type ListaCatalogoEntry,
} from "../panes/ordenCategoriasModel";

/** Solo las preguntas de opción tienen categorías que ordenar. */
export function esPreguntaDeOpcion(v: Pick<VariableInstrumento, "tipo">): boolean {
  const tipo = (v.tipo ?? "").trim().toLowerCase();
  return tipo.startsWith("select_one") || tipo.startsWith("select_multiple");
}

/**
 * Las opciones de una lista (código, etiqueta y casos) y de qué pregunta salen
 * los casos: la primera de la lista que trae opciones en la base. Los casos son
 * los de esa pregunta, no la suma de la lista.
 */
export function opcionesDeLaLista(
  preguntas: readonly VariableInstrumento[],
  dataReview: readonly DataReviewVariable[],
): { opciones: DataReviewOption[]; fuente: string | null } {
  const nombres = new Set(preguntas.map((v) => v.name));
  const conOpciones = dataReview.find((d) => nombres.has(d.name) && d.opciones.length > 0);
  return conOpciones ? { opciones: conOpciones.opciones, fuente: conOpciones.name } : { opciones: [], fuente: null };
}

/** Listas que casan con la búsqueda, por el nombre de la lista o por el código o la etiqueta de una pregunta que la usa. */
export function listasQueCasan(
  catalogo: readonly ListaCatalogoEntry[],
  preguntas: readonly VariableInstrumento[],
  consulta: string,
): ListaCatalogoEntry[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [...catalogo];
  const porPregunta = new Set(
    preguntas
      .filter((v) => v.name.toLowerCase().includes(q) || textoPlano(v.label ?? "").toLowerCase().includes(q))
      .map((v) => (v.list_name ?? "").trim()),
  );
  return catalogo.filter((e) => e.listName.toLowerCase().includes(q) || porPregunta.has(e.listName));
}

export type CodigoEspecialDelEstudio = { code: string; label: string; casos: number };

/**
 * Los códigos especiales (90 a 99 de la casa) que aparecen en las preguntas del
 * estudio, con la etiqueta de la primera pregunta que lo trae y los casos que lo
 * eligieron sumados sobre todas.
 */
export function especialesDelEstudio(dataReview: readonly DataReviewVariable[]): CodigoEspecialDelEstudio[] {
  const porCodigo = new Map<string, CodigoEspecialDelEstudio>();
  for (const v of dataReview) {
    for (const o of v.opciones) {
      if (!esValorEspecial(o.code)) continue;
      const previo = porCodigo.get(o.code);
      if (previo) previo.casos += Math.max(0, o.count ?? 0);
      else porCodigo.set(o.code, { code: o.code, label: textoPlano(o.label ?? ""), casos: Math.max(0, o.count ?? 0) });
    }
  }
  return [...porCodigo.values()].sort((a, b) => Number(a.code) - Number(b.code));
}

/** Los especiales están al final: todos detrás de las demás categorías. Sin especiales no aplica. */
export function especialesAlFinal(codes: readonly string[]): boolean {
  if (!codes.some(esValorEspecial)) return false;
  return ordenesIguales([...codes], enviarEspecialesAlFinal([...codes]));
}

/**
 * Apaga "Especiales al final": deja las demás categorías en su orden y devuelve
 * cada especial al lugar que le da el formulario (detrás de las categorías que
 * lo preceden allí).
 */
export function especialesEnSuLugar(codes: readonly string[], formulario: readonly string[]): string[] {
  const resultado = codes.filter((c) => !esValorEspecial(c));
  const especiales = formulario.filter((c) => esValorEspecial(c) && codes.includes(c));
  for (const especial of especiales) {
    const indice = formulario.indexOf(especial);
    const antes = new Set(formulario.slice(0, indice));
    let posicion = 0;
    resultado.forEach((c, i) => { if (antes.has(c)) posicion = i + 1; });
    resultado.splice(posicion, 0, especial);
  }
  // Los especiales que el formulario no trae se quedan al final, en su orden.
  for (const c of codes) if (!resultado.includes(c)) resultado.push(c);
  return resultado;
}

/** La línea "Al final, fuera del orden" va antes del primer especial cuando todos quedan atrás. */
export function indiceDelSeparador(codes: readonly string[]): number | null {
  if (!especialesAlFinal(codes)) return null;
  const i = codes.findIndex(esValorEspecial);
  return i > 0 ? i : null;
}

/** Alt con las flechas sube o baja una posición; Alt con Inicio o Fin lleva al extremo. Otra tecla, null. */
export function moverConTeclado(codes: readonly string[], indice: number, tecla: string, alt: boolean): string[] | null {
  if (!alt) return null;
  const lista = [...codes];
  const siguiente = tecla === "ArrowUp" ? moverArriba(lista, indice)
    : tecla === "ArrowDown" ? moverAbajo(lista, indice)
      : tecla === "Home" ? moverAlInicio(lista, indice)
        : tecla === "End" ? moverAlFinal(lista, indice)
          : null;
  return siguiente;
}

export type CifrasDeCategorias = {
  listas: number;
  ordinales: number;
  especialesEnUso: number;
  preguntasConLista: number;
  preguntas: number;
};

export function cifrasDeCategorias(
  catalogo: readonly ListaCatalogoEntry[],
  especiales: readonly CodigoEspecialDelEstudio[],
  preguntas: readonly VariableInstrumento[],
): CifrasDeCategorias {
  return {
    listas: catalogo.length,
    ordinales: catalogo.filter((e) => e.ordinalEfectivo).length,
    especialesEnUso: especiales.filter((e) => e.casos > 0).length,
    preguntasConLista: preguntas.filter((v) => esPreguntaDeOpcion(v) && (v.list_name ?? "").trim() !== "").length,
    preguntas: preguntas.length,
  };
}
