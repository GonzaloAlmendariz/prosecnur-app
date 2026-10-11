/**
 * Modelo del panel «Cómo se emparejaron las preguntas» (ADR 0094, ítem 15).
 *
 * Lógica pura: conteos, filtro, agrupación por sección y la dirección que abre
 * o cierra el panel. El componente solo pinta lo que este módulo decide.
 */
import {
  EMPAREJAMIENTO_ESTADOS_FILA,
  type CargaFuentesEmparejamiento,
  type EmparejamientoEstadoFila,
  type EmparejamientoFila,
  type EmparejamientoFuente,
} from "../../api/cargaFuentes";
import { conNivel } from "../../lib/navegacion/direccion";
import { panelAbiertoEn } from "../../lib/navegacion/paneles";
import { CARGA_REVIEW_SIN_RESPUESTAS } from "./cargaReviewFuentesModel";
import { PANEL_EMPAREJAMIENTO_FUENTE } from "./panelesCarga";

export type EmparejamientoFiltro = "diferencias" | "todas";

export type EmparejamientoEstadoMeta = {
  estado: EmparejamientoEstadoFila;
  /** Texto de la insignia: nunca se deja el estado solo al color. */
  insignia: string;
  /** Rótulo de la cifra del encabezado. */
  cifra: string;
  /** Una línea para la leyenda. */
  leyenda: string;
};

export const EMPAREJAMIENTO_ESTADOS: Record<EmparejamientoEstadoFila, EmparejamientoEstadoMeta> = {
  emparejada: {
    estado: "emparejada",
    insignia: "Emparejada",
    cifra: "Emparejadas",
    leyenda: "La misma pregunta, con el mismo nombre en la base y en la fuente.",
  },
  otro_nombre: {
    estado: "otro_nombre",
    insignia: "Con otro nombre",
    cifra: "Con otro nombre",
    leyenda: "La misma pregunta; en la fuente se llama distinto y sus respuestas van a la variable de la base.",
  },
  no_entro: {
    estado: "no_entro",
    insignia: "No entró a la base",
    cifra: "No entraron",
    leyenda: "Solo existe en la fuente: sus respuestas no se incorporaron.",
  },
  sin_respuesta: {
    estado: "sin_respuesta",
    insignia: "Sin respuesta en esta fuente",
    cifra: "Sin respuesta en esta fuente",
    leyenda: "Existe en la base, pero la fuente no la pregunta: queda vacía para sus respuestas.",
  },
  ambigua: {
    estado: "ambigua",
    insignia: "Ambigua — no se emparejó",
    cifra: "Ambiguas",
    leyenda: "La pregunta se repite un número distinto de veces en la base y en la fuente; no se emparejó para no cruzarla.",
  },
};

export const EMPAREJAMIENTO_SECCION_SOLO_FUENTE = "Solo en la fuente";

export type EmparejamientoConteos = Record<EmparejamientoEstadoFila, number>;

export function conteosDeFuente(fuente: Pick<EmparejamientoFuente, "filas">): EmparejamientoConteos {
  const conteos = Object.fromEntries(
    EMPAREJAMIENTO_ESTADOS_FILA.map((estado) => [estado, 0]),
  ) as EmparejamientoConteos;
  for (const fila of fuente.filas) conteos[fila.estado] += 1;
  return conteos;
}

export function esDiferencia(fila: Pick<EmparejamientoFila, "estado">): boolean {
  return fila.estado !== "emparejada";
}

export function hayDiferencias(fuente: Pick<EmparejamientoFuente, "filas">): boolean {
  return fuente.filas.some(esDiferencia);
}

/** «Solo diferencias» si hay alguna; si no, todas. */
export function filtroInicial(fuente: Pick<EmparejamientoFuente, "filas"> | null): EmparejamientoFiltro {
  return fuente && hayDiferencias(fuente) ? "diferencias" : "todas";
}

export function filtrarFilas(
  filas: readonly EmparejamientoFila[],
  filtro: EmparejamientoFiltro,
): EmparejamientoFila[] {
  return filtro === "diferencias" ? filas.filter(esDiferencia) : [...filas];
}

/** El nombre de la variable cambia entre la base y la fuente: se resalta. */
export function nombreDifiere(fila: Pick<EmparejamientoFila, "variable_base" | "variable_fuente">): boolean {
  return Boolean(fila.variable_base && fila.variable_fuente && fila.variable_base !== fila.variable_fuente);
}

/**
 * Filas consecutivas que comparten pregunta madre (una matriz). Con
 * `enunciado = ""` el bloque es una pregunta suelta, o varias seguidas.
 */
export type EmparejamientoBloque = {
  enunciado: string;
  filas: EmparejamientoFila[];
};

export type EmparejamientoGrupo = {
  seccion: string;
  filas: EmparejamientoFila[];
  bloques: EmparejamientoBloque[];
};

/**
 * Corta las filas en bloques por `enunciado` consecutivo. Solo se juntan las
 * filas contiguas: dos matrices con el mismo enunciado separadas por otra
 * pregunta siguen siendo dos bloques, como en el instrumento.
 */
export function bloquesPorEnunciado(filas: readonly EmparejamientoFila[]): EmparejamientoBloque[] {
  const bloques: EmparejamientoBloque[] = [];
  for (const fila of filas) {
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && ultimo.enunciado === fila.enunciado) ultimo.filas.push(fila);
    else bloques.push({ enunciado: fila.enunciado, filas: [fila] });
  }
  return bloques;
}

/**
 * Agrupa por sección conservando el orden del instrumento: cada sección aparece
 * donde aparece su primera pregunta, y «Solo en la fuente» va siempre al final.
 */
export function agruparPorSeccion(filas: readonly EmparejamientoFila[]): EmparejamientoGrupo[] {
  const grupos = new Map<string, EmparejamientoFila[]>();
  for (const fila of filas) {
    const seccion = fila.seccion || (fila.estado === "no_entro" ? EMPAREJAMIENTO_SECCION_SOLO_FUENTE : "Sin sección");
    const lista = grupos.get(seccion);
    if (lista) lista.push(fila);
    else grupos.set(seccion, [fila]);
  }
  const salida = [...grupos.entries()].map(([seccion, lista]) => ({
    seccion,
    filas: lista,
    bloques: bloquesPorEnunciado(lista),
  }));
  return [
    ...salida.filter((grupo) => grupo.seccion !== EMPAREJAMIENTO_SECCION_SOLO_FUENTE),
    ...salida.filter((grupo) => grupo.seccion === EMPAREJAMIENTO_SECCION_SOLO_FUENTE),
  ];
}

export function nombreDeFuente(fuente: Pick<EmparejamientoFuente, "titulo" | "survey_id"> | null): string {
  return fuente?.titulo || "esta fuente";
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

/**
 * Lo primero que dice el encabezado cuando la fuente no entró a la base, con
 * cuántas respuestas quedaron fuera. `null` si la fuente entró.
 */
export function avisoExclusion(fuente: Pick<EmparejamientoFuente, "estado" | "n_filas_excluidas" | "n_emparejadas" | "n_preguntas_base">): string | null {
  if (fuente.estado !== "excluida") return null;
  const n = fuente.n_filas_excluidas;
  const fuera = n > 0
    ? `${n.toLocaleString("es-PE")} ${plural(n, "respuesta quedó fuera", "respuestas quedaron fuera")}`
    : "Sus respuestas quedaron fuera";
  const porque = fuente.n_preguntas_base > 0
    ? ` porque solo coinciden ${fuente.n_emparejadas} de ${fuente.n_preguntas_base} preguntas.`
    : ".";
  return `Esta fuente no entró a la base: ${fuera}${porque}`;
}

/**
 * El dato de respuestas del encabezado. Una fuente incorporada sin ninguna
 * todavía lo dice con la misma frase que su tarjeta en Revisión; una excluida
 * ya lo dice en el aviso de exclusión; sin el dato, no se afirma nada.
 */
export function datoRespuestas(fuente: Pick<EmparejamientoFuente, "estado" | "n_filas_incorporadas">): string | null {
  if (fuente.estado === "excluida" || fuente.n_filas_incorporadas === null) return null;
  const n = fuente.n_filas_incorporadas;
  if (n === 0) return CARGA_REVIEW_SIN_RESPUESTAS;
  return `${n.toLocaleString("es-PE")} ${plural(n, "respuesta de esta fuente está", "respuestas de esta fuente están")} en la base.`;
}

/** La fuente pedida por `foco`; sin foco, la primera. */
export function fuenteEnFoco(
  datos: Pick<CargaFuentesEmparejamiento, "fuentes"> | null,
  foco: string | null,
): EmparejamientoFuente | null {
  const fuentes = datos?.fuentes ?? [];
  if (!fuentes.length) return null;
  if (!foco) return fuentes[0];
  return fuentes.find((fuente) => fuente.survey_id === foco) ?? null;
}

// ---------------------------------------------------------------------------
// Dirección: `?panel=emparejamiento&foco=<survey_id>`
// ---------------------------------------------------------------------------
//
// Se escribe con `conNivel` y se lee con `panelAbiertoEn`, de la gramática
// compartida: este módulo no conoce los nombres de los params.

/** Abre el panel sobre una fuente, conservando el resto de la dirección. */
export function searchConEmparejamiento(search: string, surveyId: string): string {
  return conNivel(conNivel(search, "panel", PANEL_EMPAREJAMIENTO_FUENTE.id), "foco", surveyId || null);
}

/**
 * Cierra el panel y limpia el foco: si quedara puesto, el siguiente «Ver
 * preguntas» podría abrir la fuente anterior. No toca el panel de otro.
 */
export function searchSinEmparejamiento(search: string): string {
  if (!panelAbiertoEn(search, PANEL_EMPAREJAMIENTO_FUENTE)) return search;
  return conNivel(conNivel(search, "panel", null), "foco", null);
}

/**
 * El enlace a otra pestaña no arrastra el `foco` de una fuente: ahí no
 * identifica nada.
 */
export function hrefSinFoco(href: string): string {
  const corte = href.indexOf("?");
  if (corte < 0) return href;
  return `${href.slice(0, corte)}${conNivel(href.slice(corte), "foco", null)}`;
}
