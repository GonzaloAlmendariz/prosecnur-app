// Codificación, Preguntas (etapa P3a del rediseño de Procesamiento): la lista se arma por UNIDADES.
//
// Una unidad es un par enlazado (la pregunta que se codifica y su texto abierto) o una pregunta suelta.
// El backend entrega preguntas; aquí se juntan en unidades, se filtran y se dice en qué estado está cada
// una. Sin React y sin red: lo que decide qué fila se ve, qué cuenta cada filtro y qué pasa al soltar una
// pregunta sobre otra vive en este archivo y se prueba en `modeloUnidades.test.ts`.

import { arquetipoOf, type Arquetipo, type PreguntaAbierta } from "../../../api/codificacion";
import type { TipoDePregunta } from "../../../components/procesamiento/FichaPregunta";
import type { ChromeStatusTone } from "../../../components/ModuleCommandBar";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import { textoPlano } from "../../../lib/textoPlano";
import { decisionDePregunta, presentarDecision, restanteDeDecision } from "../decisionCodificacion";

export type FiltroPreguntas = "con-texto" | "por-codificar" | "codificadas" | "todas";
export type ModoSo = "padre" | "hijo";

export type Unidad = {
  /** El `parent` de la pregunta que gobierna la unidad: sobre ella actúan los controles. */
  id: string;
  clase: "pareja" | "suelta";
  principal: PreguntaAbierta;
  arquetipo: Arquetipo;
  /** Lado izquierdo de la fila: la pregunta cerrada, o la que quedó como principal de una pareja. */
  cerrada: PreguntaAbierta | null;
  /** Lado derecho: la pregunta de texto. En una pareja puede faltar si su columna no está en la lista. */
  texto: PreguntaAbierta | null;
  /** Columna de texto de la pareja; vacía en una suelta. */
  columnaTexto: string;
};

export type SeccionDeUnidades = { id: string; rotulo: string; unidades: Unidad[] };

export type ConteosDeFiltro = Record<FiltroPreguntas, number>;

const SIN_ORDEN = 999999;

export function columnaEmparejada(p: PreguntaAbierta): string {
  const pareja = p.pareja;
  return pareja && typeof pareja === "object" && "child_col" in pareja && pareja.child_col ? pareja.child_col : "";
}

export function columnaOtros(p: PreguntaAbierta): string {
  const pareja = p.pareja;
  return pareja && typeof pareja === "object" && "dummy_col" in pareja && pareja.dummy_col ? pareja.dummy_col : "";
}

export function esEmparejada(p: PreguntaAbierta): boolean {
  return columnaEmparejada(p) !== "";
}

export function esCerrada(p: PreguntaAbierta): boolean {
  return p.tipo === "select_one" || p.tipo === "select_multiple";
}

/** Columna de texto de cada pareja, con la pregunta que la tomó. */
export function adoptadasPor(preguntas: readonly PreguntaAbierta[]): Map<string, PreguntaAbierta> {
  const mapa = new Map<string, PreguntaAbierta>();
  for (const p of preguntas) {
    const columna = columnaEmparejada(p);
    if (columna) mapa.set(columna, p);
  }
  return mapa;
}

/**
 * Las unidades en el orden del formulario. Un texto que ya es de una pareja no hace fila propia: va
 * dentro de la unidad de la pregunta que lo tomó.
 */
export function armarUnidades(preguntas: readonly PreguntaAbierta[]): Unidad[] {
  const adoptadas = adoptadasPor(preguntas);
  const textoPorColumna = new Map<string, PreguntaAbierta>();
  for (const p of preguntas) {
    if (p.tipo === "text") textoPorColumna.set(p.col_efectiva || p.parent, p);
  }
  const ordenadas = [...preguntas].sort((a, b) => (a.q_order ?? SIN_ORDEN) - (b.q_order ?? SIN_ORDEN));
  const unidades: Unidad[] = [];
  for (const p of ordenadas) {
    const arquetipo = arquetipoOf(p, adoptadas);
    if (arquetipo === "adoptada") continue;
    const columnaTexto = columnaEmparejada(p);
    if (columnaTexto) {
      const texto = textoPorColumna.get(columnaTexto) ?? null;
      unidades.push({ id: p.parent, clase: "pareja", principal: p, arquetipo, cerrada: p, texto: texto === p ? null : texto, columnaTexto });
    } else if (esCerrada(p)) {
      unidades.push({ id: p.parent, clase: "suelta", principal: p, arquetipo, cerrada: p, texto: null, columnaTexto: "" });
    } else {
      unidades.push({ id: p.parent, clase: "suelta", principal: p, arquetipo, cerrada: null, texto: p, columnaTexto: "" });
    }
  }
  return unidades;
}

/** Las preguntas de la unidad: la principal y, en una pareja, su texto. */
export function preguntasDeUnidad(u: Unidad): PreguntaAbierta[] {
  return u.clase === "pareja" && u.texto ? [u.principal, u.texto] : [u.principal];
}

function sinDecidir(p: PreguntaAbierta): boolean {
  return Boolean(presentarDecision(decisionDePregunta(p))?.abierta);
}

/**
 * Lo que se codifica: una pareja o una pregunta abierta (de texto o numérica). Una cerrada suelta, del
 * tipo que sea, queda fuera aunque el motor le cuente respuestas (las de una múltiple son cadenas de
 * códigos, no texto): solo sirve como destino para emparejar y aparece en "Todas".
 */
export function tieneTexto(u: Unidad): boolean {
  return u.clase === "pareja" || !esCerrada(u.principal);
}

/**
 * El filtro con el que se muestra la lista. Se abre en "Con texto"; si la base no tiene ninguna unidad
 * con texto, eso sería un vacío, y se muestra "Todas".
 */
export function filtroVigente(filtro: FiltroPreguntas, conteos: ConteosDeFiltro): FiltroPreguntas {
  return filtro === "con-texto" && conteos["con-texto"] === 0 && conteos.todas > 0 ? "todas" : filtro;
}

/**
 * Ejemplos del texto que se va a codificar: los de la pregunta abierta de la unidad. Una cerrada trae
 * códigos, no texto, así que una cerrada suelta o una pareja sin su pregunta de texto no tienen ejemplos.
 */
export function ejemplosDeUnidad(u: Unidad, maximo = 5): string[] {
  const abierta = u.clase === "pareja" ? u.texto : esCerrada(u.principal) ? null : u.principal;
  return (abierta?.preview ?? []).filter((texto) => texto.trim() !== "").slice(0, maximo);
}

/** Una pareja de opción única a la que todavía no se le dijo qué variable recibe los códigos. */
export function faltaModo(u: Unidad): boolean {
  return u.clase === "pareja" && u.principal.tipo === "select_one" && u.principal.modo_so === "";
}

/** Cómo se dibuja la unidad: dos bloques enlazados, un bloque a todo el ancho o un bloque en su lado. */
export function formaDeUnidad(u: Unidad): "pareja" | "abierta" | "cerrada" {
  if (u.clase === "pareja") return "pareja";
  return esCerrada(u.principal) ? "cerrada" : "abierta";
}

/**
 * Si la unidad entra en un filtro. Vale para la lista y para el conteo del filtro, que así cuenta
 * exactamente las filas que se ven al elegirlo.
 */
export function unidadEnFiltro(u: Unidad, filtro: FiltroPreguntas): boolean {
  if (filtro === "con-texto") return tieneTexto(u);
  if (filtro === "por-codificar") return preguntasDeUnidad(u).some(sinDecidir);
  if (filtro === "codificadas") return preguntasDeUnidad(u).some((p) => p.status === "completo");
  return true;
}

export function contarFiltros(unidades: readonly Unidad[]): ConteosDeFiltro {
  const cuenta = (filtro: FiltroPreguntas) => unidades.filter((u) => unidadEnFiltro(u, filtro)).length;
  return {
    "con-texto": cuenta("con-texto"),
    "por-codificar": cuenta("por-codificar"),
    codificadas: cuenta("codificadas"),
    todas: unidades.length,
  };
}

export function unidadCoincide(u: Unidad, consulta: string): boolean {
  const q = consulta.trim().toLowerCase();
  if (!q) return true;
  if (u.columnaTexto.toLowerCase().includes(q)) return true;
  return preguntasDeUnidad(u).some(
    (p) =>
      p.parent.toLowerCase().includes(q) ||
      p.parent_label.toLowerCase().includes(q) ||
      textoPlano(p.section_label).toLowerCase().includes(q),
  );
}

/** Las unidades visibles, agrupadas por sección del formulario en el orden en que aparecen. */
export function seccionesVisibles(unidades: readonly Unidad[], filtro: FiltroPreguntas, consulta: string): SeccionDeUnidades[] {
  const secciones = new Map<string, SeccionDeUnidades>();
  for (const u of unidades) {
    if (!unidadEnFiltro(u, filtro) || !unidadCoincide(u, consulta)) continue;
    const id = u.principal.section || "(sin sección)";
    const rotulo = textoPlano(u.principal.section_label) || u.principal.section || "Sin sección";
    const seccion = secciones.get(id) ?? { id, rotulo, unidades: [] };
    seccion.unidades.push(u);
    secciones.set(id, seccion);
  }
  return [...secciones.values()];
}

// ---------- Estado de la unidad ----------

export type ClaveDeEstado = "sin-decidir" | "codificada" | "no-se-codifica" | "sin-respuestas" | "emparejada" | "desactivada";

export type EstadoDeUnidad = {
  clave: ClaveDeEstado;
  rotulo: string;
  tono: ChromeStatusTone;
  /** Lo que acompaña al chip: cuánto falta o el motivo registrado. */
  nota: string | null;
  /** Para el `title` del chip. */
  detalle: string;
};

/** Una pareja de opción múltiple todavía sin decir cuál de sus opciones es "Otros". */
export function faltaOpcionOtros(u: Unidad): boolean {
  return u.clase === "pareja" && u.principal.tipo === "select_multiple" && columnaOtros(u.principal) === "";
}

/**
 * El estado que muestra la fila. Usa las mismas reglas que los filtros: una fila con "Sin decidir" es
 * una de las que cuenta ese filtro, y lo mismo con "Codificada" y con la pareja.
 */
export function estadoDeUnidad(u: Unidad): EstadoDeUnidad | null {
  if (u.arquetipo === "no-aplica") {
    return { clave: "desactivada", rotulo: "Desactivada", tono: "neutral", nota: null, detalle: "No entra a codificación." };
  }
  const preguntas = preguntasDeUnidad(u);
  const abierta = preguntas.find(sinDecidir);
  if (abierta) {
    const presentacion = presentarDecision(decisionDePregunta(abierta));
    return {
      clave: "sin-decidir",
      rotulo: "Sin decidir",
      tono: "warn",
      nota: restanteDeDecision(abierta) ?? presentacion?.etiqueta ?? null,
      detalle: presentacion?.detalle ?? "",
    };
  }
  const descartada = preguntas.find((p) => decisionDePregunta(p) === "no_categorizar");
  if (descartada) {
    const motivo = descartada.no_categorizar?.motivo?.trim() || null;
    return {
      clave: "no-se-codifica",
      rotulo: "No se codifica",
      tono: "neutral",
      nota: motivo,
      detalle: motivo ? `Motivo: ${motivo}` : "Decisión registrada.",
    };
  }
  if (preguntas.some((p) => p.status === "completo")) {
    return { clave: "codificada", rotulo: "Codificada", tono: "success", nota: null, detalle: "Todas sus respuestas tienen código." };
  }
  if (preguntas.some((p) => decisionDePregunta(p) === "sin_material")) {
    return { clave: "sin-respuestas", rotulo: "Sin respuestas", tono: "neutral", nota: null, detalle: "No hay texto que codificar." };
  }
  if (u.clase === "pareja") {
    return { clave: "emparejada", rotulo: "Emparejada", tono: "neutral", nota: null, detalle: "Tiene su texto enlazado." };
  }
  return null;
}

/**
 * "426 respuestas, 425 únicas", o nada si la pregunta no trae respuestas de texto. En una cerrada
 * suelta no se pinta: lo que el motor le cuenta son sus propios códigos.
 */
export function cifrasDeUnidad(u: Unidad): string | null {
  const p = u.principal;
  if (!tieneTexto(u) || !(p.n_respuestas > 0)) return null;
  return `${formatoConteoDe(p.n_respuestas, "respuesta")}, ${formatoConteoDe(p.n_unicas, "única")}`;
}

// ---------- Tipo de pregunta ----------

export function tipoDeFicha(tipo: string): TipoDePregunta {
  if (tipo === "select_one") return "unica";
  if (tipo === "select_multiple") return "multiple";
  if (tipo === "integer") return "numerica";
  return "texto";
}

/** Etiqueta corta y sin marcado, para el fantasma del arrastre. */
export function etiquetaCorta(etiqueta: string, maximo = 72): string {
  const limpia = textoPlano(etiqueta);
  return limpia.length > maximo ? `${limpia.slice(0, maximo - 1).trimEnd()}…` : limpia;
}

// ---------- Emparejar ----------

/** Una suelta se puede levantar y recibe a otra, salvo que esté desactivada. */
export function admiteEmparejar(u: Unidad): boolean {
  return u.clase === "suelta" && u.arquetipo !== "no-aplica";
}

export type DestinoDeArrastre = "directo" | "con-dialogo";

/**
 * Qué pasa al soltar `origen` sobre `destino`. Un texto sobre una cerrada sin pareja se une de
 * inmediato; cualquier otra combinación de dos sueltas pide decidir cuál aporta el texto. Entre
 * unidades que no admiten emparejar no pasa nada.
 */
export function destinoDeArrastre(origen: Unidad, destino: Unidad): DestinoDeArrastre | null {
  if (origen.id === destino.id) return null;
  if (!admiteEmparejar(origen) || !admiteEmparejar(destino)) return null;
  if (origen.principal.tipo === "text" && esCerrada(destino.principal)) return "directo";
  return "con-dialogo";
}

/** Con qué se elige la otra pregunta sin arrastrar: una cerrada busca su columna de texto; el resto, otra pregunta. */
export function selectorDeEmparejar(u: Unidad): "columna" | "pregunta" | null {
  if (!admiteEmparejar(u)) return null;
  return esCerrada(u.principal) ? "columna" : "pregunta";
}

/**
 * Si la unidad lleva el interruptor de incluir en codificación. Una pareja entra siempre; una pregunta
 * de texto o numérica suelta se incluye a mano; una cerrada sin texto no tiene qué codificar.
 */
export function admiteIncluir(u: Unidad): boolean {
  if (u.principal.marcada_auto) return true;
  if (u.arquetipo === "no-aplica" || u.arquetipo === "config-so") return false;
  return u.clase === "pareja" || !esCerrada(u.principal);
}

// ---------- Modo de una pareja de opción única ----------

export function defaultModoSoForQuickAdopt(tipo: string): ModoSo | undefined {
  return tipo === "select_one" ? "padre" : undefined;
}

export function modoSoOptionsForDisplay(parent: string, childCol: string): Array<{ value: ModoSo; label: string; title: string }> {
  return [
    {
      value: "padre",
      label: "Codificar pregunta original",
      title: `Crear ${parent}_recod con opciones originales y categorías provenientes de ${childCol}`,
    },
    {
      value: "hijo",
      label: "Codificar texto aparte",
      title: `Crear ${childCol}_recod como texto aparte`,
    },
  ];
}

/** Qué le toca a cada lado de una pareja según el modo. Sin modo (opción múltiple) no hay nada que decir. */
export function papelesDePareja(modo: PreguntaAbierta["modo_so"]): { cerrada: string; texto: string } | null {
  if (modo === "padre") return { cerrada: "Se recodifica con sus opciones", texto: "Aporta categorías nuevas" };
  if (modo === "hijo") return { cerrada: "Queda como está", texto: "Se codifica como texto aparte" };
  return null;
}
