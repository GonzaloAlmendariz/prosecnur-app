// Codificación, Aplicar: lo que la pantalla dice del plan que devuelve el motor
// (`/api/codificacion/plan-adaptacion`). Puro: se prueba sin React ni red.
//
// Toda cifra sale del plan y de una sola función. Las del resumen cuentan solo
// las preguntas que el motor declara aplicables (`bridge_soportado`): los totales
// del motor incluyen también las que quedan fuera, y con ellos la franja diría
// una pregunta más de las que la lista muestra.

import type { PlanAdaptacion, PlanPregunta } from "../../../api/dashboard";
import type { TipoDePregunta } from "../../../components/procesamiento/FichaPregunta";
import type { AvisoDeFranja, DestinoDeFranja, GrupoDeFranja } from "../../../components/procesamiento/FranjaRecorrido";
import { enumerar } from "../../../lib/enumerar";
import { formatoConteo, formatoConteoDe, numeroFinito } from "../../../lib/formatoNumero";
import { textoPlano } from "../../../lib/textoPlano";

export type ResumenAplicar = {
  /** Las preguntas que se aplican, en el orden del plan. */
  aplicables: PlanPregunta[];
  /** Las que tienen códigos y el motor no puede aplicar todavía, con su causa. */
  fuera: PlanPregunta[];
  codigosNuevos: number;
  codigosExistentes: number;
  /** Preguntas aplicables que declaran el campo que crean. */
  camposNuevos: number;
};

const entero = (valor: unknown): number => Math.max(0, Math.round(numeroFinito(valor) ?? 0));

export function resumenDelPlan(plan: Pick<PlanAdaptacion, "preguntas">): ResumenAplicar {
  const preguntas = Array.isArray(plan.preguntas) ? plan.preguntas : [];
  const aplicables = preguntas.filter((p) => p.bridge_soportado);
  return {
    aplicables,
    fuera: preguntas.filter((p) => !p.bridge_soportado),
    codigosNuevos: aplicables.reduce((suma, p) => suma + entero(p.n_codigos_nuevos), 0),
    codigosExistentes: aplicables.reduce((suma, p) => suma + entero(p.n_codigos_reutilizados), 0),
    camposNuevos: aplicables.filter((p) => (p.nueva_variable ?? "").trim() !== "").length,
  };
}

export const ETIQUETA_FRANJA = "Qué se agrega a la base";
export const AVISO_BASE_CAMBIO = "La base cambió después de la última aplicación: ya no tiene los campos de códigos";

export type FranjaDeAplicar = {
  etiqueta: string;
  grupos: GrupoDeFranja[];
  destino?: DestinoDeFranja;
  avisos: AvisoDeFranja[];
};

/**
 * Las columnas que agrega la aplicación: una por pregunta y, en una de opción múltiple (campo con
 * comodín), una por código.
 */
export function columnasNuevas(aplicables: readonly PlanPregunta[]): number {
  return aplicables.reduce((suma, p) => {
    const campo = (p.nueva_variable ?? "").trim();
    if (!campo) return suma;
    return suma + (campo.includes("*") ? entero(p.n_codigos_nuevos) + entero(p.n_codigos_reutilizados) : 1);
  }, 0);
}

/**
 * La franja (`pp-via` del prototipo): lo que se agrega a la base (columnas, códigos nuevos y respuestas con
 * código) y, aparte, las preguntas con códigos que no entran todavía. "Sin código propio" (cuántas quedan en
 * "Otro") no sale del plan: el motor no la cuenta antes de aplicar.
 */
export const AVISO_ORIGINALES = "Las respuestas originales se conservan";

export function franjaDeAplicar(
  resumen: ResumenAplicar,
  opciones: { baseCambio?: boolean; sinCodigo?: number | null } = {},
): FranjaDeAplicar {
  const columnas = columnasNuevas(resumen.aplicables);
  const respuestas = resumen.aplicables.reduce((suma, p) => suma + entero(p.n_respuestas_afectadas), 0);
  const fuera = resumen.fuera.length;
  const grupos: GrupoDeFranja[] = [
    {
      id: "se-agrega",
      rotulo: "Se agrega a la base",
      cifras: [
        { id: "columnas", cifra: formatoConteo(columnas), texto: columnas === 1 ? "columna" : "columnas" },
        { id: "codigos-nuevos", cifra: formatoConteo(resumen.codigosNuevos), texto: resumen.codigosNuevos === 1 ? "código nuevo" : "códigos nuevos" },
        { id: "respuestas", cifra: formatoConteo(respuestas), texto: respuestas === 1 ? "respuesta con código" : "respuestas con código" },
      ],
    },
  ];
  // "Sin código propio": las respuestas de las preguntas que se aplican que entran sin código (la misma
  // cuenta que "Faltan N" en la lista). Sin el avance leído, el tramo no se dibuja.
  const sinCodigo = opciones.sinCodigo;
  if (typeof sinCodigo === "number") {
    grupos.push({
      id: "sin-codigo",
      rotulo: "Sin código propio",
      cifras: [{ id: "sin-codigo", cifra: formatoConteo(sinCodigo), texto: sinCodigo === 1 ? "respuesta queda sin código" : "respuestas quedan sin código", ...(sinCodigo > 0 ? { tono: "aviso" as const } : {}) }],
    });
  }
  grupos.push({
    id: "no-entran",
    rotulo: "No entran todavía",
    aparte: true,
    cifras: [{ id: "preguntas-fuera", cifra: formatoConteo(fuera), texto: fuera === 1 ? "pregunta" : "preguntas", ...(fuera > 0 ? { tono: "aviso" as const } : {}) }],
  });
  return {
    etiqueta: ETIQUETA_FRANJA,
    grupos,
    avisos: [
      ...(opciones.baseCambio ? [{ id: "base-cambio", tono: "aviso" as const, texto: AVISO_BASE_CAMBIO }] : []),
      // Aplicar agrega columnas de códigos; no reescribe las respuestas.
      { id: "originales", tono: "conforme" as const, texto: AVISO_ORIGINALES },
    ],
  };
}

/** El tipo de la pregunta para su ficha. Un tipo que la ficha no conoce no se colorea. */
export function tipoDeFicha(tipo: string): TipoDePregunta | null {
  if (tipo === "select_one") return "unica";
  if (tipo === "select_multiple") return "multiple";
  if (tipo === "integer") return "numerica";
  if (tipo === "text") return "texto";
  return null;
}

/** El tipo en palabras, para que no dependa solo del color. Un tipo desconocido no se nombra. */
export function tipoEnPalabras(p: Pick<PlanPregunta, "tipo" | "modo_so">): string {
  if (p.tipo === "select_one" && p.modo_so === "hijo") return "Opción única, texto codificado aparte";
  if (p.tipo === "select_one" && p.modo_so === "padre") return "Opción única, pregunta original codificada";
  if (p.tipo === "select_one") return "Opción única";
  if (p.tipo === "select_multiple") return "Opción múltiple";
  if (p.tipo === "integer") return "Numérica por rangos";
  if (p.tipo === "text") return "Texto abierto";
  if (p.tipo === "agrupacion") return "Agrupación de categorías";
  return "";
}

/** La etiqueta de la pregunta sin marcado; si el formulario no la trae, su código. */
export function etiquetaDePregunta(p: Pick<PlanPregunta, "parent" | "parent_label">): string {
  return textoPlano(p.parent_label) || p.parent;
}

/**
 * La identidad de una pregunta del plan. Una pregunta codificada y su agrupación de categorías
 * comparten `parent` y se distinguen por el campo que crean.
 */
export function claveDePregunta(p: Pick<PlanPregunta, "parent" | "nueva_variable">): string {
  return `${p.parent}::${(p.nueva_variable ?? "").trim()}`;
}

/** La pregunta elegida para el detalle: la de esa clave o, si no hay o ya no está, la primera. */
export function preguntaElegida(aplicables: readonly PlanPregunta[], clave: string | null): PlanPregunta | null {
  return aplicables.find((p) => claveDePregunta(p) === clave) ?? aplicables[0] ?? null;
}

/** A qué fila lleva una tecla desde la fila `desde`. `null` si la tecla no mueve la selección. */
export function filaTrasTecla(tecla: string, desde: number, total: number): number | null {
  if (total <= 0) return null;
  if (tecla === "ArrowDown") return Math.min(desde + 1, total - 1);
  if (tecla === "ArrowUp") return Math.max(desde - 1, 0);
  if (tecla === "Home") return 0;
  if (tecla === "End") return total - 1;
  return null;
}

/**
 * El nombre del campo nuevo como se lee. Una pregunta de opción múltiple agrega una columna por código y
 * el motor la declara con un comodín (`D1_information/*_recod`); se muestra con el primer código de la
 * pregunta en lugar del comodín (`D1_information/1_recod`) y el patrón completo queda en el `title`.
 */
export function campoLegible(
  campo: string,
  p: Pick<PlanPregunta, "codigos_nuevos" | "codigos_reutilizados">,
): { nombre: string; porCodigo: boolean; titulo: string } {
  const limpio = campo.trim();
  if (!limpio.includes("*")) return { nombre: limpio, porCodigo: false, titulo: limpio };
  const primero = [...(Array.isArray(p.codigos_nuevos) ? p.codigos_nuevos : []), ...(Array.isArray(p.codigos_reutilizados) ? p.codigos_reutilizados : [])]
    .map((c) => String(c.codigo ?? "").trim())
    .find(Boolean);
  return {
    nombre: primero ? limpio.replace("*", primero) : limpio.replace("*", "código"),
    porCodigo: true,
    titulo: `Una columna por código: ${limpio.replace("*", "código")}`,
  };
}

/** El rótulo que acompaña al campo: "Campo nuevo" o, en una múltiple, "Una columna por código, como". */
export function rotuloDeCampo(porCodigo: boolean): string {
  return porCodigo ? "Una columna por código, como" : "Campo nuevo";
}

export type FilaDeAplicar = {
  /** `claveDePregunta`. */
  id: string;
  codigo: string;
  etiqueta: string;
  tipo: TipoDePregunta | null;
  tipoEnPalabras: string;
  /** El campo que se agrega a la base, como se lee (`campoLegible`). Vacío si el plan no lo declara. */
  campo: string;
  /** El patrón que declara el motor, para el `title`. */
  campoTitulo: string;
  /** Una pregunta de opción múltiple agrega un campo por código. */
  variosCampos: boolean;
  /**
   * "6 códigos nuevos y 2 ya existentes". Vacío si el plan no trae ninguno o si es la única
   * pregunta que se aplica: entonces esos conteos son los de la franja y la fila no los repite.
   */
  codigos: string;
  /** "142 respuestas con código". Vacío si el plan no trae la cuenta. */
  respuestas: string;
};

export function filaDeAplicar(p: PlanPregunta, opciones: { unica?: boolean } = {}): FilaDeAplicar {
  const nuevos = entero(p.n_codigos_nuevos);
  const existentes = entero(p.n_codigos_reutilizados);
  const respuestas = numeroFinito(p.n_respuestas_afectadas);
  return {
    id: claveDePregunta(p),
    codigo: p.parent,
    etiqueta: etiquetaDePregunta(p),
    tipo: tipoDeFicha(p.tipo),
    tipoEnPalabras: tipoEnPalabras(p),
    campo: campoLegible(p.nueva_variable ?? "", p).nombre,
    campoTitulo: campoLegible(p.nueva_variable ?? "", p).titulo,
    variosCampos: p.tipo === "select_multiple" || campoLegible(p.nueva_variable ?? "", p).porCodigo,
    codigos: opciones.unica ? "" : enumerar([
      nuevos > 0 && formatoConteoDe(nuevos, "código nuevo", "códigos nuevos"),
      existentes > 0 && formatoConteoDe(existentes, nuevos > 0 ? "ya existente" : "código ya existente", nuevos > 0 ? "ya existentes" : "códigos ya existentes"),
    ]),
    respuestas: respuestas == null ? "" : formatoConteoDe(respuestas, "respuesta con código", "respuestas con código"),
  };
}

export type OrigenDeCodigo = "nuevo" | "existente";

export const ROTULO_DE_ORIGEN: Record<OrigenDeCodigo, string> = { nuevo: "Nuevo", existente: "Ya existente" };

export type CodigoDeDetalle = {
  id: string;
  codigo: string;
  /** Vacía si el plan no la trae. */
  etiqueta: string;
  origen: OrigenDeCodigo;
  /** Las respuestas que recibe, escritas ("24", "0"). Vacío si el plan no trae la cuenta de ese código. */
  respuestas: string;
  /** Entre 0 y 1: sus respuestas sobre las del código con más respuestas de la pregunta. Sin cuenta o con 0, 0. */
  proporcion: number;
};

/**
 * El desglose por código de una pregunta: primero los nuevos y después los que ya existían
 * como opción, en el orden del plan. Es otro dato que los totales de su fila.
 */
export function codigosDeDetalle(p: Pick<PlanPregunta, "codigos_nuevos" | "codigos_reutilizados">): CodigoDeDetalle[] {
  const de = (origen: OrigenDeCodigo, lista: PlanPregunta["codigos_nuevos"] | undefined) =>
    (Array.isArray(lista) ? lista : []).map((c, i) => ({ c, i, origen, n: numeroFinito(c.n_respuestas) }));
  const todos = [...de("nuevo", p.codigos_nuevos), ...de("existente", p.codigos_reutilizados)];
  const mayor = Math.max(0, ...todos.map((x) => x.n ?? 0));
  return todos.map(({ c, i, origen, n }) => ({
    id: `${origen}-${c.codigo}-${i}`,
    codigo: String(c.codigo ?? "").trim(),
    etiqueta: textoPlano(c.etiqueta),
    origen,
    respuestas: n == null ? "" : formatoConteo(n),
    proporcion: n != null && n > 0 && mayor > 0 ? Math.min(n / mayor, 1) : 0,
  }));
}

export const EFECTO_APLICAR = "Escribe los campos nuevos en la base y genera la base codificada y el formulario codificado.";
export const EFECTO_SIN_APLICAR = "No se escribe nada en la base.";

/** Lo que pasa al pulsar "Aplicar a la base", dicho antes de pulsar. */
export function efectoDeAplicar(nPreguntas: number, baseYaCodificada: boolean): string {
  return nPreguntas > 0 && !baseYaCodificada ? EFECTO_APLICAR : EFECTO_SIN_APLICAR;
}

/**
 * Antes y después de aplicar una pregunta (`pp-cambio` del prototipo): la columna que la base trae hoy
 * (el texto que se codificó, o la pregunta) y el campo que se agrega, con su tipo. `null` si el plan no
 * declara el campo nuevo.
 */
export function cambioDeLaBase(
  p: Pick<PlanPregunta, "parent" | "text_col" | "tipo" | "modo_so" | "nueva_variable" | "codigos_nuevos" | "codigos_reutilizados">,
): { hoy: string; hoyTipo: string; agrega: string; agregaTitulo: string; agregaTipo: string } | null {
  const campo = campoLegible(p.nueva_variable ?? "", p);
  if (!campo.nombre) return null;
  const texto = (p.text_col ?? "").trim();
  const hoy = texto || p.parent;
  const hoyTipo = texto ? "Texto" : p.tipo === "integer" ? "Numérica" : p.tipo === "select_one" ? "Opción única" : p.tipo === "select_multiple" ? "Opción múltiple" : "Texto";
  const agregaTipo = p.tipo === "select_multiple" || campo.porCodigo ? "Opción múltiple" : "Opción única";
  return { hoy, hoyTipo, agrega: campo.nombre, agregaTitulo: campo.titulo, agregaTipo };
}
