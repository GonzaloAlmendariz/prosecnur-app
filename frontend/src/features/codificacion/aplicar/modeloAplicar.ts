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

export const ETIQUETA_FRANJA = "De la codificación a la base codificada";
export const AVISO_BASE_CAMBIO = "La base cambió después de la última aplicación: ya no tiene los campos de códigos";

export type FranjaDeAplicar = {
  etiqueta: string;
  grupos: GrupoDeFranja[];
  destino: DestinoDeFranja;
  avisos: AvisoDeFranja[];
};

/** La franja de recorrido: de dónde sale lo que se aplica y a dónde llega. */
export function franjaDeAplicar(resumen: ResumenAplicar, opciones: { baseCambio?: boolean } = {}): FranjaDeAplicar {
  const n = resumen.aplicables.length;
  return {
    etiqueta: ETIQUETA_FRANJA,
    grupos: [
      { id: "codificacion", rotulo: "Codificación", cifras: [{ id: "preguntas", cifra: n, texto: n === 1 ? "pregunta" : "preguntas" }] },
      {
        id: "codigos",
        rotulo: "Códigos",
        cifras: [
          { id: "codigos-nuevos", cifra: resumen.codigosNuevos, texto: resumen.codigosNuevos === 1 ? "nuevo" : "nuevos" },
          { id: "codigos-existentes", cifra: resumen.codigosExistentes, texto: resumen.codigosExistentes === 1 ? "ya existente" : "ya existentes" },
        ],
      },
    ],
    destino: {
      rotulo: "Base codificada",
      cifra: resumen.camposNuevos,
      nota: resumen.camposNuevos === 1 ? "campo nuevo" : "campos nuevos",
    },
    avisos: opciones.baseCambio ? [{ id: "base-cambio", tono: "aviso", texto: AVISO_BASE_CAMBIO }] : [],
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

export type FilaDeAplicar = {
  /** `claveDePregunta`. */
  id: string;
  codigo: string;
  etiqueta: string;
  tipo: TipoDePregunta | null;
  tipoEnPalabras: string;
  /** El campo que se agrega a la base. Vacío si el plan no lo declara. */
  campo: string;
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
    campo: (p.nueva_variable ?? "").trim(),
    variosCampos: p.tipo === "select_multiple",
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
