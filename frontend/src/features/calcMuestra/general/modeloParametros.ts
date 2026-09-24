/**
 * Método de Muestra general (G2 · F1): qué parámetros pinta la técnica, cómo
 * se elige la confianza y qué correcciones del motor siguen vigentes. Sin
 * React, para probarlo sin montar nada.
 *
 * El motor declara qué consume cada técnica (`GET /tecnicas/parametros`):
 * un campo que no mueve el n es peor que un campo ausente, porque el usuario
 * lo ajusta y cree que ajustó el diseño.
 */
import type {
  CalcMuestraAvisoParametro,
  CalcMuestraComponente,
  CalcMuestraParametros,
} from "../../../api/calcMuestra";
import {
  normalizeCalcMuestraAvisosParametros,
  type CalcMuestraCatalogoParametros,
  type CalcMuestraParametroDeTecnica,
} from "../../../api/calcMuestraGeneral";

export type NivelConfianza = { etiqueta: string; z: number };

/** Los tres niveles que se ofrecen; el z es lo que consume el motor. */
export const NIVELES_CONFIANZA: readonly NivelConfianza[] = [
  { etiqueta: "90 %", z: 1.645 },
  { etiqueta: "95 %", z: 1.96 },
  { etiqueta: "99 %", z: 2.576 },
];

/** El nivel que corresponde a un z, o `null` si no es uno de los tres. */
export function nivelDeZ(z: number | null | undefined): NivelConfianza | null {
  if (z == null || !Number.isFinite(z)) return null;
  return NIVELES_CONFIANZA.find((n) => Math.abs(n.z - z) < 0.005) ?? null;
}

/** «1.96»: es-PE usa punto decimal, como el resto de cifras de la mesa. */
export function formatearZ(z: number): string {
  return String(Math.round(z * 1000) / 1000);
}

export type TipoCampo = "confianza" | "proporcion" | "numero" | "entero" | "opciones";

const PROPORCIONES = new Set([
  "p", "e", "tasa_respuesta", "oversample_pct", "cobertura_objetivo", "tau", "tasa_contacto", "tasa_elegibilidad",
]);
const ENTEROS = new Set(["n_minimo_estrato", "tope_operativo", "promedio_conglomerado"]);

export function tipoDeCampo(clave: string, tipoDelMotor: "numero" | "opciones" = "numero"): TipoCampo {
  if (clave === "z") return "confianza";
  if (tipoDelMotor === "opciones" || OPCIONES_CONOCIDAS[clave]) return "opciones";
  if (ENTEROS.has(clave)) return "entero";
  if (PROPORCIONES.has(clave)) return "proporcion";
  return "numero";
}

// Un motor anterior a `tipo`/`opciones` no las declara; éstas se conocen.
const OPCIONES_CONOCIDAS: Record<string, string[]> = {
  estadistico_conglomerado: ["media", "mediana", "min_media_mediana"],
};

const ETIQUETA_OPCION: Record<string, string> = {
  media: "Media",
  mediana: "Mediana",
  min_media_mediana: "Menor de media y mediana",
  proporcional: "Proporcional",
  neyman: "Neyman",
  potencia: "Potencia",
  proporcion: "Proporción",
};

/** Las opciones del campo: las del motor o, si no las declara, las conocidas. */
export function opcionesDe(param: CalcMuestraParametroDeTecnica): Array<{ valor: string; etiqueta: string }> {
  const valores = param.opciones.length > 0 ? param.opciones : OPCIONES_CONOCIDAS[param.clave] ?? [];
  return valores.map((valor) => ({ valor, etiqueta: ETIQUETA_OPCION[valor] ?? valor }));
}

/** El valor de un campo de opciones; sin valor guardado, la primera (el default del motor). */
export function valorDeOpcion(parametros: CalcMuestraParametros, param: CalcMuestraParametroDeTecnica): string {
  const valor = (parametros as Record<string, unknown>)[param.clave];
  const opciones = opcionesDe(param);
  return typeof valor === "string" && opciones.some((o) => o.valor === valor) ? valor : opciones[0]?.valor ?? "";
}

// ---------------------------------------------------------------------------
// Qué se estima: proporción o media
// ---------------------------------------------------------------------------

export type TipoIndicador = "proporcion" | "media";

/** El indicador vigente; sin valor guardado, la proporción (el default del motor). */
export function tipoIndicadorDe(parametros: CalcMuestraParametros): TipoIndicador {
  return parametros.tipo_indicador === "media" ? "media" : "proporcion";
}

/**
 * Los parámetros que se pintan. El catálogo declara `p` y `cv` porque los dos
 * existen para la técnica, pero cada uno sólo mueve el n con su indicador:
 * con una proporción se pinta `p`; con una media, `cv`. «Qué se estima» va
 * primero porque decide el resto.
 */
export function parametrosVisibles(
  parametros: readonly CalcMuestraParametroDeTecnica[],
  valores: CalcMuestraParametros,
): CalcMuestraParametroDeTecnica[] {
  const indicador = parametros.find((p) => p.clave === "tipo_indicador");
  const esMedia = Boolean(indicador) && tipoIndicadorDe(valores) === "media";
  // Con una media se oculta p y también la asignación: el motor reparte
  // proporcional porque Neyman y potencia necesitan la variabilidad de cada
  // estrato, que una media no declara.
  const ocultas = new Set(esMedia ? ["p", "asignacion"] : ["cv"]);
  const resto = parametros.filter((p) => p.clave !== "tipo_indicador" && !ocultas.has(p.clave));
  return indicador ? [indicador, ...resto] : resto;
}

export const AYUDA_MARGEN_MEDIA = "Relativo a la media: 0,05 = ±5 % de la media.";

/** La ayuda del motor, salvo el margen de una media, que es relativo. */
export function ayudaDeParametro(param: CalcMuestraParametroDeTecnica, valores: CalcMuestraParametros): string {
  if (param.clave === "e" && tipoIndicadorDe(valores) === "media") return AYUDA_MARGEN_MEDIA;
  return param.ayuda;
}

/** Rango aceptado por el motor, cuando lo tiene. */
export function limitesDe(clave: string): { min: number; max?: number } {
  if (clave === "cv") return { min: 0.01, max: 10 };
  return { min: 0 };
}

/** Default del motor que se muestra como placeholder mientras no haya valor guardado. */
export function placeholderDe(clave: string): string | undefined {
  return clave === "cv" ? "1" : undefined;
}

const CLAVES_PARAMETRO: ReadonlySet<string> = new Set<keyof CalcMuestraParametros>([
  "z", "p", "e", "deff", "tau", "oversample_pct", "tasa_contacto", "tasa_elegibilidad", "tasa_respuesta",
  "cobertura_objetivo", "promedio_conglomerado", "n_minimo_estrato", "tope_operativo", "estadistico_conglomerado",
  "asignacion", "tipo_indicador", "cv",
]);

/** El patch de `parametros` que escribe un campo; `null` si la clave no es un parámetro conocido. */
export function patchDeParametro(clave: string, valor: number | string): Partial<CalcMuestraParametros> | null {
  if (!CLAVES_PARAMETRO.has(clave)) return null;
  return Object.fromEntries([[clave, valor]]) as Partial<CalcMuestraParametros>;
}

/** Técnicas cuyo catálogo declara `tipo_indicador`. */
const TECNICAS_CON_INDICADOR: ReadonlySet<string> = new Set(["prob_aleatorio_simple", "sistematico", "prob_estratificado"]);

/**
 * Cómo se lee la precisión alcanzada en Resultados: en una media el error es
 * relativo, así que no son puntos sino un porcentaje de la media.
 */
export function precisionEnPalabras(comp: Pick<CalcMuestraComponente, "tecnica" | "parametros">, valor: string): string {
  if (valor === "—" || tipoIndicadorDe(comp.parametros) !== "media") return valor;
  return TECNICAS_CON_INDICADOR.has(comp.tecnica) ? `±${valor} de la media` : valor;
}

/** Paso del campo numérico: fino donde el valor es chico, entero donde cuenta casos. */
export function pasoDe(clave: string): number {
  if (clave === "e") return 0.005;
  if (clave === "p") return 0.01;
  if (clave === "deff" || clave === "cv") return 0.1;
  if (ENTEROS.has(clave)) return 1;
  return 0.05;
}

/** Los parámetros que la técnica consume; `null` si el catálogo no la conoce. */
export function parametrosDeTecnica(
  catalogo: CalcMuestraCatalogoParametros | null,
  tecnica: string,
): CalcMuestraParametroDeTecnica[] | null {
  if (!catalogo) return null;
  return catalogo[tecnica] ?? null;
}

export function valorNumerico(parametros: CalcMuestraParametros, clave: string): number | null {
  const valor = (parametros as Record<string, unknown>)[clave];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/**
 * Correcciones del motor que siguen vigentes, por parámetro. Un aviso vale
 * mientras el parámetro conserve el valor que el motor usó en su lugar; si el
 * usuario lo cambió, el aviso ya no describe lo que hay y no se pinta.
 */
export function avisosVigentes(
  comp: Pick<CalcMuestraComponente, "parametros" | "avisos_parametros">,
): Record<string, CalcMuestraAvisoParametro> {
  const vigentes: Record<string, CalcMuestraAvisoParametro> = {};
  for (const aviso of normalizeCalcMuestraAvisosParametros(comp.avisos_parametros)) {
    const actual = valorNumerico(comp.parametros, aviso.param);
    if (actual != null && Math.abs(actual - aviso.usado) < 1e-9) vigentes[aviso.param] = aviso;
  }
  return vigentes;
}

/**
 * Neyman sólo reparte distinto si algún estrato trae su proporción esperada;
 * sin ninguna, el motor usa la p global y reparte igual que proporcional.
 */
export function neymanSinPPorEstrato(comp: Pick<CalcMuestraComponente, "parametros" | "marco">): boolean {
  if (comp.parametros.asignacion !== "neyman") return false;
  return !(comp.marco.estratos ?? []).some((e) => typeof e.p_facultad === "number" && e.p_facultad > 0 && e.p_facultad < 1);
}

/** Cómo se repartió el n entre estratos, si el motor usó la fórmula por estrato. */
export function lineaDeAsignacion(comp: Pick<CalcMuestraComponente, "resultado">): string | null {
  const formula = comp.resultado?.formula_n;
  if (formula === "neyman") return "Reparto entre estratos: Neyman · n calculado por estrato.";
  if (formula === "potencia") return "Reparto entre estratos: potencia (Bankier) · n calculado por estrato.";
  if (formula === "proporcional_por_estrato") return "Reparto entre estratos: proporcional · n calculado con la p de cada estrato.";
  return null;
}

/** Correcciones con que se calculó el resultado (van junto al n en Resultados). */
export function avisosDelResultado(comp: Pick<CalcMuestraComponente, "resultado">): CalcMuestraAvisoParametro[] {
  return normalizeCalcMuestraAvisosParametros(comp.resultado?.avisos_parametros);
}
