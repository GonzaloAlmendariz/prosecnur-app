// La cifra al lado y el gráfico con su desglose bajo cada barra (U13 del checklist de mandos del mazo; ADR 0129 §9). No es
// un tipo de lámina: es una disposición de `p_slide_2_graficos` que se pide con `meta.composicion = "cifra_lateral"` y la
// cifra en `meta.cifra` (`fila`, `rotulo`, `texto`, `franja`, `comparacion`; api/R/lamina_cifra_y_grafico.R). La cifra es
// la respuesta `fila` de la pregunta del gráfico de la izquierda; el de la derecha tiene que ser una categórica en barras
// sin dividir, o la lámina vuelve a los dos gráficos con aviso. Puro.

import type { Slide } from "../../../../api/graficos";
import type { SlideMeta } from "../../slideMeta";
import { leerTarjetas, opcionActiva } from "../diferencias/modeloTarjetas";
import { escribirComparacion, leerComparacion, type TipoComparacion } from "../hallazgos/modeloCapitulosHallazgos";

export const LAMINA_CIFRA_LATERAL = "p_slide_2_graficos";
export const COMPOSICION_CIFRA_LATERAL = "cifra_lateral";
/** El gráfico de la derecha: el que el motor desglosa bajo cada barra (`.tarjetas_en_linea_aplica`). */
const GRAFICADORES_DERECHA: ReadonlySet<string> = new Set(["p_barras_agrupadas"]);

export type CifraLateral = {
  fila: string;
  rotulo: string;
  texto: string;
  /** La franja con la otra respuesta; el motor la dibuja salvo `franja: false`. */
  franja: boolean;
  comparacion: TipoComparacion;
  comparacionTexto: string;
};

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const texto = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : "");

export const cifraLateralActiva = (meta: SlideMeta): boolean => texto(meta.composicion) === COMPOSICION_CIFRA_LATERAL;

export function leerCifraLateral(meta: SlideMeta): CifraLateral {
  const c = esObjeto(meta.cifra) ? meta.cifra : {};
  return {
    fila: texto(c.fila), rotulo: texto(c.rotulo), texto: texto(c.texto), franja: c.franja !== false,
    ...leerComparacion(c.comparacion),
  };
}

/**
 * La `meta` con la composición encendida o apagada. Apagar quita sólo `composicion`: la cifra escrita se conserva para
 * volver a encender sin perderla (el motor no la lee sin la composición).
 */
export function metaConComposicion(meta: SlideMeta, activa: boolean): SlideMeta {
  const siguiente: SlideMeta = { ...meta };
  if (activa) siguiente.composicion = COMPOSICION_CIFRA_LATERAL;
  else delete siguiente.composicion;
  return siguiente;
}

/**
 * La `meta` con la cifra cambiada. Lo vacío (texto en blanco, la franja encendida, la comparación automática) borra su
 * clave para que mande el motor; las claves que el editor no maneja (`cruces`, `top2box`, `filtros`) se conservan.
 */
export function metaConCifra(meta: SlideMeta, cambio: Partial<CifraLateral>): SlideMeta {
  const actual = { ...leerCifraLateral(meta), ...cambio };
  const c: Record<string, unknown> = { ...(esObjeto(meta.cifra) ? meta.cifra : {}) };
  for (const k of ["fila", "rotulo", "texto"] as const) {
    // El texto se guarda como se escribe (recortarlo a cada tecla comería el espacio entre palabras); el motor lo recorta.
    if (actual[k].trim()) c[k] = actual[k];
    else delete c[k];
  }
  if (actual.franja) delete c.franja;
  else c.franja = false;
  const comp = escribirComparacion(actual);
  if (comp === "auto" || comp === "") delete c.comparacion;
  else c.comparacion = comp;
  const siguiente: SlideMeta = { ...meta };
  if (Object.keys(c).length) siguiente.cifra = c;
  else delete siguiente.cifra;
  return siguiente;
}

type GraficoEnRanura = { graficador: string; var: string; cruce: string };

function graficoEn(slide: Pick<Slide, "payload">, slot: string): GraficoEnRanura | null {
  const g = (slide.payload as Record<string, unknown> | undefined)?.[slot];
  if (!esObjeto(g) || typeof g.graficador !== "string") return null;
  const a = esObjeto(g.args) ? g.args : {};
  const v = texto(a.var) || (Array.isArray(a.vars) ? texto(a.vars) : "");
  return { graficador: g.graficador, var: v, cruce: texto(a.cruces) || texto(a.cruce) };
}

/** La pregunta de la cifra: la del gráfico de la izquierda (`els[[1]]$var`). Vacía si no hay. */
export const preguntaDeLaCifra = (slide: Pick<Slide, "payload">): string => graficoEn(slide, "izquierda")?.var ?? "";

/**
 * Lo que falta para que el motor componga la cifra al lado, en palabras del analista; `null` si se puede. Con algo
 * pendiente la lámina sale como dos gráficos y el motor lo avisa.
 */
export function faltaParaCifraLateral(slide: Pick<Slide, "tipo" | "payload">): string | null {
  if (slide.tipo !== LAMINA_CIFRA_LATERAL) return "Sólo en la lámina de dos gráficos.";
  const izq = graficoEn(slide, "izquierda");
  if (!izq?.var) return "Elige la pregunta del gráfico de la izquierda: de ahí sale la cifra.";
  const der = graficoEn(slide, "derecha");
  if (!der || !GRAFICADORES_DERECHA.has(der.graficador)) return "El gráfico de la derecha tiene que ser de barras.";
  if (der.cruce) return "El gráfico de la derecha va sin dividir: sus grupos salen bajo cada barra.";
  return null;
}

/** ¿La cifra ya dice qué respuesta cuenta? Sin `fila`, el motor no la compone. */
export const cifraCompleta = (c: Pick<CifraLateral, "fila">): boolean => c.fila.trim() !== "";

/**
 * ¿Los grupos de la derecha salen bajo cada barra? Los calcula el motor con las tarjetas de esa ranura
 * (`.tarjetas_de_ranuras`, hasta dos); apagadas, el gráfico va sin desglose.
 */
export const desgloseEncendido = (meta: SlideMeta): boolean => opcionActiva(leerTarjetas(meta, "derecha"));
