// El tipo de la columna que sale de codificar una pregunta (plan 5.3, "Única o múltiple"): no se pregunta,
// se hereda de la pregunta cerrada o sale de lo codificado. Puro.
//
// Lo que hace hoy el motor (leído en el plan 5.3 y en `api/R/codificacion_aplicar_instrumento.R`): un
// texto unido a una pregunta de opción única produce una columna de opción única; unido a una múltiple,
// una múltiple; una numérica, opción única por rangos; una abierta sin pregunta cerrada, opción única
// salvo que alguna persona tenga más de un código (casos de la matriz, `matrix_cases`).
//
// Lo que falta del prototipo es de motor (D12, fase F4): que un "Otro" de opción única con dos códigos
// pase a múltiple. Hasta entonces una pareja de opción única siempre sale única y la mesa no deja sumar
// un segundo código.

import type { Arquetipo, Grupo, PreguntaAbierta } from "../../../api/codificacion";
import type { TipoDePregunta } from "../../../components/procesamiento/FichaPregunta";
import { formatoConteo } from "../../../lib/formatoNumero";

export type TipoResultante = {
  /** `null` mientras no se puede saber: una abierta sin códigos. */
  tipo: TipoDePregunta | null;
  rotulo: string;
  /** De dónde sale el tipo, en una frase corta. */
  leyenda: string;
};

const POR_DEFINIR: TipoResultante = { tipo: null, rotulo: "Por definir", leyenda: "Se define al codificar" };

export const ROTULO_DE_TIPO: Record<TipoDePregunta, string> = {
  unica: "Única",
  multiple: "Múltiple",
  numerica: "Numérica",
  texto: "Texto",
};

function heredado(tipo: "unica" | "multiple", pregunta: string): TipoResultante {
  return { tipo, rotulo: ROTULO_DE_TIPO[tipo], leyenda: `Igual que su pregunta ${pregunta}` };
}

/** Respuestas (personas) con más de un código: un caso de la matriz con dos códigos o un texto en dos códigos. */
export function respuestasConVariosCodigos(grupos: readonly Grupo[]): number {
  const porCaso = new Map<string, Set<string>>();
  for (const g of grupos) for (const c of g.matrix_cases ?? []) {
    const codigos = porCaso.get(c.id_caso) ?? new Set<string>();
    codigos.add(c.codigo || g.codigo);
    porCaso.set(c.id_caso, codigos);
  }
  let casos = 0;
  for (const codigos of porCaso.values()) if (codigos.size > 1) casos += 1;
  const porTexto = new Map<string, number>();
  for (const g of grupos) for (const clave of new Set(g.respuestas)) porTexto.set(clave, (porTexto.get(clave) ?? 0) + 1);
  let textos = 0;
  for (const n of porTexto.values()) if (n > 1) textos += 1;
  return casos + textos;
}

/**
 * El tipo resultante de la pregunta que se está codificando, con sus códigos a la vista.
 * `pregunta` es la que recibe los códigos; en una pareja, la cerrada.
 */
export function tipoResultanteActivo(
  pregunta: Pick<PreguntaAbierta, "parent" | "tipo">,
  arquetipo: Arquetipo,
  grupos: readonly Grupo[],
): TipoResultante {
  if (arquetipo === "pareja-sm") return heredado("multiple", pregunta.parent);
  if (arquetipo === "pareja-so" || arquetipo === "config-so") return heredado("unica", pregunta.parent);
  if (arquetipo === "auto") return { tipo: "unica", rotulo: ROTULO_DE_TIPO.unica, leyenda: "Un código por rango" };
  const conCodigo = grupos.some((g) => g.respuestas.length > 0 || (g.matrix_cases?.length ?? 0) > 0);
  if (!conCodigo) return POR_DEFINIR;
  const varios = respuestasConVariosCodigos(grupos);
  if (varios > 0) {
    return { tipo: "multiple", rotulo: ROTULO_DE_TIPO.multiple, leyenda: `${formatoConteo(varios)} ${varios === 1 ? "respuesta con varios códigos" : "respuestas con varios códigos"}` };
  }
  return { tipo: "unica", rotulo: ROTULO_DE_TIPO.unica, leyenda: "Ninguna respuesta con varios códigos" };
}

/**
 * El tipo resultante en la lista de preguntas, con lo que la lista sabe (sin los códigos de cada una).
 * Una abierta con códigos devuelve `null`: puede ser única o múltiple según sus casos, y eso solo se ve al
 * abrirla.
 */
export function tipoResultanteDeLista(pregunta: Pick<PreguntaAbierta, "parent" | "tipo" | "n_codificadas">, arquetipo: Arquetipo): TipoResultante | null {
  if (arquetipo === "pareja-sm") return heredado("multiple", pregunta.parent);
  if (arquetipo === "pareja-so" || arquetipo === "config-so") return heredado("unica", pregunta.parent);
  if (arquetipo === "auto") return { tipo: "unica", rotulo: ROTULO_DE_TIPO.unica, leyenda: "Un código por rango" };
  return (pregunta.n_codificadas ?? 0) > 0 ? null : POR_DEFINIR;
}

/** El origen de la pregunta en la lista: de qué cerrada es el "Otro", o si es abierta. */
export function origenDeLista(pregunta: Pick<PreguntaAbierta, "parent" | "tipo">, arquetipo: Arquetipo): string {
  if (arquetipo === "pareja-sm" || arquetipo === "pareja-so" || arquetipo === "config-so") return `Otro de ${pregunta.parent}`;
  if (arquetipo === "auto") return "Numérica";
  return "Abierta";
}
