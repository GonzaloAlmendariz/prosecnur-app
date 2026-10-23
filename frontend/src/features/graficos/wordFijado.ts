import type { ArgMetadata } from "../../api/graficos";
import type { WordFijado, WordFijadoValor } from "../../api/graficosWordFijado";
import { escalaVisualDeArg } from "./argEscalaVisual";
import { humanizeIdentifier } from "./graficadorDisplay";

// Modelo puro del candado «Lo fija el recetario» del editor de ajustes Word: qué args del preset se pintan cerrados,
// qué texto sale para su valor y cuándo el proyecto guarda algo que el Word no usa. Sin React para poder probarlo solo.

export const SIN_EFECTO_EN_WORD = "Sin efecto en el Word";

export type ArgFijadoDelPreset = { meta: ArgMetadata; fijado: WordFijado };

export type ArgsPartidosPorFijado = {
  /** Args del preset que el analista sí puede ajustar para el Word. */
  editables: ArgMetadata[];
  /** Args del preset que el recetario fija: se pintan cerrados en su grupo. */
  fijadosDelPreset: ArgFijadoDelPreset[];
  /** Ajustes fijados que no son args del preset: van al grupo «Lo fija el recetario» del final. */
  fijadosSueltos: WordFijado[];
};

export function fijadosPorArg(fijados: readonly WordFijado[] | undefined): Record<string, WordFijado> {
  const out: Record<string, WordFijado> = {};
  for (const f of fijados ?? []) if (!(f.arg in out)) out[f.arg] = f;
  return out;
}

export function partirArgsPorFijado(
  args: readonly ArgMetadata[],
  fijados: readonly WordFijado[] | undefined,
): ArgsPartidosPorFijado {
  const indice = fijadosPorArg(fijados);
  const editables: ArgMetadata[] = [];
  const fijadosDelPreset: ArgFijadoDelPreset[] = [];
  const nombres = new Set<string>();
  for (const meta of args) {
    nombres.add(meta.name);
    const fijado = indice[meta.name];
    if (fijado) fijadosDelPreset.push({ meta, fijado });
    else editables.push(meta);
  }
  const fijadosSueltos = (fijados ?? []).filter((f) => !nombres.has(f.arg));
  return { editables, fijadosDelPreset, fijadosSueltos };
}

/**
 * Decisión 5a: un ajuste fijado no es una decisión del proyecto aunque el estado guarde un valor viejo, porque no llega
 * al Word. Se quita de las decisiones; si a un tipo no le queda ninguna, vuelve a «Hereda».
 */
export function decisionesSinFijados(
  decisiones: Record<string, Record<string, unknown>>,
  fijadosPorPreset: Record<string, readonly WordFijado[] | undefined>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [tipo, args] of Object.entries(decisiones)) {
    const indice = fijadosPorArg(fijadosPorPreset[tipo]);
    const quedan: Record<string, unknown> = {};
    for (const [arg, valor] of Object.entries(args)) if (!(arg in indice)) quedan[arg] = valor;
    if (Object.keys(quedan).length > 0) out[tipo] = quedan;
  }
  return out;
}

const NUMERO = new Intl.NumberFormat("es", { maximumFractionDigits: 3 });

function etiquetaDeChoice(meta: ArgMetadata | undefined, valor: string): string | undefined {
  const choice = (meta?.choices ?? []).find((c) => String(c.value) === valor);
  return choice ? choice.label || choice.value : undefined;
}

function textoDeNumero(n: number, meta: ArgMetadata | undefined, unidad: string | undefined): string {
  // Sin metadatos del catálogo ni unidad declarada no hay escala conocida: el número va tal cual (nunca se infiere
  // «proporción» por el nombre de un arg que el catálogo del editor no describe).
  if (!meta && !unidad) return NUMERO.format(n);
  const base: ArgMetadata = meta ?? { name: "", label: "", tipo_input: "number", grupo: "diagnostico" };
  const escala = escalaVisualDeArg({ ...base, unidad: unidad ?? base.unidad });
  const numero = NUMERO.format(n * escala.escala);
  const u = escala.unidad;
  if (!u) return numero;
  if (u.toLowerCase().startsWith("propor")) return `${numero} (proporción)`;
  return `${numero} ${u}`;
}

function textoDeValor(valor: WordFijadoValor, meta: ArgMetadata | undefined, unidad: string | undefined): string {
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "number") return textoDeNumero(valor, meta, unidad);
  const t = valor.trim();
  if (t.length === 0) return "(vacío)";
  return etiquetaDeChoice(meta, t) ?? t;
}

/**
 * Rótulos de los ajustes que el recetario fija en la escala Word (`api/R/reporte_word_escala_fijados.R`). Muchos no son
 * args del preset y llegan sin metadatos: sin esta tabla el grupo «Lo fija el recetario» mostraba el identificador
 * humanizado («Size Leyenda», «Barra Extra Semaforo»), que no se lee (C5).
 */
export const ROTULOS_FIJADOS_WORD: Readonly<Record<string, string>> = {
  size_leyenda: "Tamaño de la leyenda",
  legend_key_cm: "Tamaño del cuadro de la leyenda",
  leyenda_posicion: "Posición de la leyenda",
  mostrar_leyenda: "Mostrar la leyenda",
  legend_n_por_fila: "Elementos de la leyenda por fila",
  size_texto_barras: "Tamaño del texto en barras",
  size_texto_barras_peq: "Tamaño del texto en barras pequeñas",
  color_texto_barras: "Color del texto en barras",
  color_texto_barras_fuera: "Color del texto fuera de la barra",
  mostrar_valores: "Mostrar los valores",
  mostrar_n_en_etiquetas: "Mostrar la frecuencia en las etiquetas",
  textos_negrita: "Textos en negrita",
  umbral_ocultar_etiqueta: "Umbral para ocultar la etiqueta",
  umbral_mostrar_etiqueta: "Umbral para mostrar la etiqueta dentro",
  umbral_etiqueta_normal: "Umbral de la etiqueta normal",
  size_ejes: "Tamaño de los ejes",
  ancho_max_eje_y: "Ancho máximo del rótulo de fila",
  barra_extra: "Barra extra",
  word_barra_extra: "Barra extra en el Word",
  size_barra_extra: "Tamaño de la cifra de la barra extra",
  size_titulo_extra: "Tamaño del título de la barra extra",
  color_barra_extra: "Color de la barra extra",
  titulo_barra_extra: "Título de la barra extra",
  prefijo_barra_extra: "Prefijo de la barra extra",
  barra_extra_semaforo: "Semáforo de la barra extra",
  barra_extra_umbral_alto: "Umbral alto del semáforo de la barra extra",
  barra_extra_umbral_medio: "Umbral medio del semáforo de la barra extra",
  grosor_barras: "Grosor de las barras",
  grosor_modo: "Modo de grosor de las barras",
  grosor_barras_mult: "Multiplicador del grosor de las barras",
  alto_por_categoria: "Alto por categoría",
};

/** Rótulo del catálogo si el arg lo trae; si no, el de la tabla de fijados del Word; el identificador sólo como último recurso. */
export function rotuloDeArg(arg: string, meta: ArgMetadata | undefined): string {
  const label = typeof meta?.label === "string" ? meta.label.trim() : "";
  if (label) return label;
  return Object.prototype.hasOwnProperty.call(ROTULOS_FIJADOS_WORD, arg)
    ? ROTULOS_FIJADOS_WORD[arg]
    : humanizeIdentifier(arg, "Ajuste");
}

// Un ajuste fijado que no es arg del preset no trae metadatos: con unidad declarada, la escala sale de su nombre + esa
// unidad (un umbral en «proporción» se lee en %), y el valor guardado se lee en la misma escala que el fijado.
function metaParaEscala(fijado: WordFijado, meta: ArgMetadata | undefined): ArgMetadata | undefined {
  if (meta) return meta;
  if (!fijado.unidad) return undefined;
  return { name: fijado.arg, label: "", tipo_input: "number", grupo: "diagnostico", unidad: fijado.unidad };
}

/** Lo que sale en el Word para un ajuste fijado, con su unidad; «Sin efecto en el Word» si no trae valor. */
export function textoValorFijado(fijado: WordFijado, meta?: ArgMetadata): string {
  if (fijado.valor === undefined) return SIN_EFECTO_EN_WORD;
  return textoDeValor(fijado.valor, metaParaEscala(fijado, meta), fijado.unidad);
}

function aValorEscalar(value: unknown): WordFijadoValor | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean" || typeof value === "string") return value;
  return undefined;
}

function textoValorGuardado(value: unknown, meta: ArgMetadata | undefined): string {
  const escalar = aValorEscalar(value);
  if (escalar !== undefined) return textoDeValor(escalar, meta, undefined);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function mismoValor(guardado: unknown, fijado: WordFijadoValor): boolean {
  if (typeof fijado === "number") {
    const n = typeof guardado === "number" ? guardado : typeof guardado === "string" ? Number(guardado.trim()) : NaN;
    return Number.isFinite(n) && Math.abs(n - fijado) < 1e-9;
  }
  if (typeof fijado === "boolean") return guardado === fijado;
  return typeof guardado === "string" && guardado.trim().toLowerCase() === fijado.trim().toLowerCase();
}

/**
 * Nota cuando el proyecto guarda, como decisión propia, un valor que el Word no usa. `guardado` es la decisión del
 * proyecto (lo que difiere de la referencia), no el default que el estado arrastra: el default no es una elección del
 * analista y repetirlo en cada tipo sería ruido. No borra nada; sólo lo dice.
 */
export function notaValorGuardado(fijado: WordFijado, guardado: unknown, meta?: ArgMetadata): string | null {
  if (guardado === undefined || guardado === null) return null;
  const guardadoTexto = textoValorGuardado(guardado, metaParaEscala(fijado, meta));
  if (fijado.valor === undefined) return `Este proyecto guarda ${guardadoTexto}, pero en el Word no tiene efecto.`;
  if (mismoValor(guardado, fijado.valor)) return null;
  return `Este proyecto guarda ${guardadoTexto}, pero el Word usa ${textoValorFijado(fijado, meta)}.`;
}
