// Codificación, Preguntas (etapa P3a del rediseño de Procesamiento): la lista se arma por UNIDADES.
//
// Una unidad es un par enlazado (la pregunta que recibe los códigos y la que aporta las respuestas) o una
// pregunta suelta.
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
  /** En una pareja, la pregunta que recibe los códigos (la que el motor guarda como dueña de la pareja). */
  principal: PreguntaAbierta;
  arquetipo: Arquetipo;
  /**
   * En una pareja, la pregunta que aporta las respuestas, del tipo que sea. Falta cuando la columna
   * emparejada no es de ninguna pregunta de la lista.
   */
  aporta: PreguntaAbierta | null;
  /** Columna que aporta las respuestas de la pareja; vacía en una suelta. */
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

/**
 * De qué pregunta es cada columna. Una pregunta responde por su nombre, por su columna en la base y,
 * mientras no esté emparejada, por la columna que el motor lee para ella. Emparejada no: entonces el
 * motor le lee la columna de la OTRA pregunta (`col_efectiva` pasa a ser la de la pareja), y contarla
 * como suya hacía que una pregunta de texto que recibe los códigos se tomara por texto de sí misma y
 * desapareciera de la lista.
 */
function preguntaPorColumna(preguntas: readonly PreguntaAbierta[]): Map<string, PreguntaAbierta> {
  const indice = new Map<string, PreguntaAbierta>();
  // El nombre de la pregunta manda; las demás columnas solo cuentan si nadie se llama así.
  for (const p of preguntas) indice.set(p.parent, p);
  for (const p of preguntas) {
    const propias = [p.parent_col, esEmparejada(p) ? "" : p.col_efectiva];
    for (const columna of propias) {
      if (columna && !indice.has(columna)) indice.set(columna, p);
    }
  }
  return indice;
}

/**
 * Las unidades en el orden del formulario. Toda pareja que guarda el motor es UNA unidad con sus dos
 * preguntas, sea cual sea la que recibe los códigos: la que aporta las respuestas no hace fila propia,
 * va dentro de la unidad de la que la tomó. Ninguna pregunta se queda sin unidad:
 *
 * - una pareja cuya columna no es de ninguna pregunta de la lista conserva la columna y va sin segunda pregunta;
 * - una pregunta que apunta a su propia columna no es pareja de nadie y va suelta;
 * - una pregunta que aporta a otra y además tiene su propia pareja conserva su fila.
 */
export function armarUnidades(preguntas: readonly PreguntaAbierta[]): Unidad[] {
  const porColumna = preguntaPorColumna(preguntas);
  const aportaDe = new Map<PreguntaAbierta, PreguntaAbierta | null>();
  for (const p of preguntas) {
    const columna = columnaEmparejada(p);
    if (!columna) continue;
    const otra = porColumna.get(columna) ?? null;
    // Apunta a sí misma: no hay pareja que mostrar.
    if (otra !== p) aportaDe.set(p, otra);
  }
  const absorbidas = new Set<PreguntaAbierta>();
  for (const otra of aportaDe.values()) {
    if (otra && !aportaDe.has(otra)) absorbidas.add(otra);
  }
  const ordenadas = [...preguntas].sort((a, b) => (a.q_order ?? SIN_ORDEN) - (b.q_order ?? SIN_ORDEN));
  const unidades: Unidad[] = [];
  for (const p of ordenadas) {
    if (absorbidas.has(p)) continue;
    // Sin el mapa de adoptadas: quién va dentro de quién lo decide este modelo, por identidad.
    const arquetipo = arquetipoOf(p);
    if (aportaDe.has(p)) {
      unidades.push({ id: p.parent, clase: "pareja", principal: p, arquetipo, aporta: aportaDe.get(p) ?? null, columnaTexto: columnaEmparejada(p) });
    } else {
      unidades.push({ id: p.parent, clase: "suelta", principal: p, arquetipo, aporta: null, columnaTexto: "" });
    }
  }
  return unidades;
}

/** Las preguntas de la unidad: la principal y, en una pareja, la que aporta las respuestas. */
export function preguntasDeUnidad(u: Unidad): PreguntaAbierta[] {
  return u.clase === "pareja" && u.aporta ? [u.principal, u.aporta] : [u.principal];
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
 * La pregunta de la que salen las respuestas que se codifican, que es de donde se toman las cifras, los
 * ejemplos y lo que falta. Importa porque el motor, en la fila de una cerrada emparejada (múltiple, o
 * única que codifica la pregunta original), cuenta `n_respuestas`, `n_unicas` y `preview` sobre la columna
 * de la CERRADA, que trae códigos; el texto lo cuenta en la fila de la pregunta abierta.
 *
 * - Suelta: ella misma si es abierta; una cerrada no tiene texto.
 * - Pareja: la pregunta que aporta, si es abierta. Si la columna emparejada no es de ninguna pregunta de
 *   la lista, vale la principal solo cuando el motor le leyó justo esa columna.
 */
export function fuenteDeRespuestas(u: Unidad): PreguntaAbierta | null {
  if (u.clase === "suelta") return esCerrada(u.principal) ? null : u.principal;
  if (u.aporta) return esCerrada(u.aporta) ? null : u.aporta;
  return u.principal.col_efectiva === u.columnaTexto ? u.principal : null;
}

/** Ejemplos del texto que se va a codificar. Sin una pregunta abierta que los aporte no hay ejemplos. */
export function ejemplosDeUnidad(u: Unidad, maximo = 5): string[] {
  return (fuenteDeRespuestas(u)?.preview ?? []).filter((texto) => texto.trim() !== "").slice(0, maximo);
}

/**
 * Lo que le falta a la pregunta `abierta` de la unidad, en respuestas únicas. En la principal de una
 * pareja las únicas son las del texto (las mismas que usa el motor para decidir el estado), no las de la
 * fila de la cerrada; si no se sabe cuáles son, no se da cifra.
 */
function restanteDeUnidad(u: Unidad, abierta: PreguntaAbierta): string | null {
  if (u.clase !== "pareja" || abierta !== u.principal) return restanteDeDecision(abierta);
  const fuente = fuenteDeRespuestas(u);
  const decision = decisionDePregunta(abierta);
  if (!fuente || (decision !== "pendiente" && decision !== "pendiente_parcial")) return null;
  const faltan = Math.trunc(fuente.n_unicas ?? 0) - Math.trunc(abierta.n_codificadas ?? 0);
  if (!Number.isFinite(faltan) || faltan <= 0) return null;
  return decision === "pendiente" ? `${faltan} por agrupar` : `${faltan} sin asignar`;
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

/** Una pareja en la que recibe una de opción múltiple, todavía sin decir cuál de sus opciones es "Otros". */
export function faltaOpcionOtros(u: Unidad): boolean {
  return u.clase === "pareja" && u.principal.tipo === "select_multiple" && columnaOtros(u.principal) === "";
}

/**
 * El rótulo de una fila con trabajo abierto. Si lo que falta es una declaración (el modo de una pareja de
 * opción única, la opción "Otros" de una múltiple, o la configuración que pide el motor), todavía no hay
 * nada que codificar y la fila dice "Sin decidir"; si está declarada y le quedan respuestas sin código,
 * dice "Por codificar".
 */
export function rotuloDeAbierta(u: Unidad, abierta: PreguntaAbierta): "Sin decidir" | "Por codificar" {
  const faltaDeclarar = decisionDePregunta(abierta) === "requiere_config" || faltaModo(u) || faltaOpcionOtros(u);
  return faltaDeclarar ? "Sin decidir" : "Por codificar";
}

/**
 * El estado que muestra la fila. Usa las mismas reglas que los filtros: una fila con "Sin decidir" o "Por codificar"
 * es una de las que cuenta ese filtro ("Pendientes"), y lo mismo con "Codificada" y con la pareja.
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
      rotulo: rotuloDeAbierta(u, abierta),
      tono: "warn",
      nota: restanteDeUnidad(u, abierta) ?? presentacion?.etiqueta ?? null,
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

/** "426 respuestas, 425 únicas" del texto que se codifica, o nada si la unidad no tiene de dónde contarlo. */
export function cifrasDeUnidad(u: Unidad): string | null {
  const fuente = fuenteDeRespuestas(u);
  if (!fuente || !(fuente.n_respuestas > 0)) return null;
  return `${formatoConteoDe(fuente.n_respuestas, "respuesta")}, ${formatoConteoDe(fuente.n_unicas, "única")}`;
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

/**
 * Qué le toca a cada pregunta de una pareja. En una de opción única lo dice el modo; en las demás, cuál
 * recibe los códigos y cuál aporta las respuestas.
 */
export function papelesDePareja(principal: PreguntaAbierta): { recibe: string; aporta: string } {
  if (principal.tipo === "select_one" && principal.modo_so === "padre") return { recibe: "Se recodifica con sus opciones", aporta: "Aporta categorías nuevas" };
  if (principal.tipo === "select_one" && principal.modo_so === "hijo") return { recibe: "Queda como está", aporta: "Se codifica como texto aparte" };
  return { recibe: "Recibe los códigos", aporta: "Aporta las respuestas" };
}

/** Si la pareja admite cambiar su columna de texto con el selector de columna: solo cuando recibe una cerrada. */
export function admiteCambiarTexto(u: Unidad): boolean {
  return u.clase === "pareja" && esCerrada(u.principal);
}

/**
 * Cuál de las dos recibe los códigos por defecto al emparejar `origen` con `destino`. Si exactamente
 * una es cerrada, recibe la cerrada, se arrastre en el sentido que se arrastre; si no, la de destino.
 */
export function recibePorDefecto(origen: PreguntaAbierta, destino: PreguntaAbierta): "origen" | "destino" {
  return esCerrada(origen) && !esCerrada(destino) ? "origen" : "destino";
}
