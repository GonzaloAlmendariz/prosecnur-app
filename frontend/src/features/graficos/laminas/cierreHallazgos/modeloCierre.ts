// El cierre con hallazgos (`p_slide_cierre_hallazgos`, arg `hallazgos`; ADR 0135 §6) en Inspector › Lámina. Cada hallazgo
// es `{lamina, cifra, texto, cifra_al_escribir?}`: el id de una lámina del plan que publica cifras (las de resumen), la
// clave estable de una de sus cifras y la frase que escribe el analista. Nada se sugiere: el texto nace vacío.
//
// La cifra es una referencia viva: el motor la lee de la lámina de origen al exportar. El editor guarda además el texto
// que se leyó al elegirla (`cifra_al_escribir`), para que el motor avise si cambió desde que se escribió la frase. Si la
// lámina de origen ya no está, o ya no tiene esa cifra, la fila lo dice y no inventa la cifra. Pura: sin React.

import type { CifraClave } from "../../../../api/graficosCifras";
import type { GraficadorRef, Slide } from "../../../../api/graficos";
import type { ReglaPreguntas } from "../../../../api/graficosRegla";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { tituloDeLamina } from "../../rotuloLamina";
import { leerSlideMeta } from "../../slideMeta";
import { SLIDE_GRAF_SLOTS, SLIDE_LABELS } from "../../store";
import { REFERENCIA_POR_DEFECTO, unirPublicos } from "../mazoResumen/modeloMazo";
import { publicosDe } from "../publicosGrafico/modeloPublicos";
import { jsonEstable, leerRegla } from "../reglaPreguntas/modeloReglaPreguntas";
import { presentacionDeGrafico } from "../selectores/intencionesContar";
import { nombreSinTitulo } from "../tituloQueSale";

export const MIN_HALLAZGOS = 3;
export const MAX_HALLAZGOS = 5;

/** Los gráficos cuya especificación publica cifras con clave (graficos_cifras_clave.R, `.CIFRAS_CLAVE_GRAFICADORES`). */
export const GRAFICADORES_CON_CIFRAS: ReadonlySet<string> = new Set([
  "p_dumbbell", "p_panorama", "p_fortalezas", "p_cobertura", "p_barras_divergentes",
]);

export const SIN_ORIGEN = "La lámina de origen ya no está";
export const SIN_CIFRA = "La cifra ya no está en su lámina de origen";

export type HallazgoCierre = {
  /** Estable entre renders (no viaja al plan). */
  clave: string;
  lamina: string;
  cifra: string;
  texto: string;
  /** La cifra como se leía al elegirla; "" si no se guardó. */
  cifraAlEscribir: string;
};

export type HallazgoEnPlan = { lamina: string; cifra: string; texto: string; cifra_al_escribir?: string };

/** Una lámina del plan de la que se pueden tomar cifras. */
export type OrigenCifras = {
  id: string;
  /** Posición visible (1, 2, 3…). */
  numero: number;
  /** «Lámina 4: Panorama de públicos». */
  nombre: string;
  graficador: string;
  args: Readonly<Record<string, unknown>>;
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

const comoObjeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Los hallazgos guardados, con una clave estable por fila (`claveDe(i)`). */
export function leerHallazgos(valor: unknown, claveDe: (i: number) => string): HallazgoCierre[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((h, i) => {
    const o = comoObjeto(h);
    return { clave: claveDe(i), lamina: texto(o.lamina), cifra: texto(o.cifra), texto: texto(o.texto), cifraAlEscribir: texto(o.cifra_al_escribir) };
  });
}

/**
 * Lo que va al plan: todas las filas, también las incompletas (el motor descarta las vacías y avisa las que no tienen
 * origen o cifra). Una fila vacía por completo no viaja.
 */
export function escribirHallazgos(hs: readonly HallazgoCierre[]): HallazgoEnPlan[] {
  return hs
    .filter((h) => h.lamina || h.cifra || h.texto)
    .map((h) => ({ lamina: h.lamina, cifra: h.cifra, texto: h.texto, ...(h.cifraAlEscribir ? { cifra_al_escribir: h.cifraAlEscribir } : {}) }));
}

/** ¿Lo guardado ya es esto? Se compara lo que viaja al plan: las filas vacías del editor no cuentan. */
export function mismosHallazgos(valor: unknown, hs: readonly HallazgoCierre[]): boolean {
  return jsonEstable(escribirHallazgos(leerHallazgos(valor, String))) === jsonEstable(escribirHallazgos(hs));
}

/** Lo que el editor muestra al abrir: lo guardado y, si no llega a tres, filas vacías hasta tres. */
export function filasIniciales(valor: unknown, claveDe: (i: number) => string): HallazgoCierre[] {
  const hs = leerHallazgos(valor, claveDe);
  const faltan = Math.max(0, MIN_HALLAZGOS - hs.length);
  return [...hs, ...Array.from({ length: faltan }, (_, k) => hallazgoNuevo(claveDe(hs.length + k)))];
}

export function hallazgoNuevo(clave: string): HallazgoCierre {
  return { clave, lamina: "", cifra: "", texto: "", cifraAlEscribir: "" };
}

/** El primer gráfico de la lámina que publica cifras, en el orden de sus ranuras. */
function graficoConCifras(slide: Slide): GraficadorRef | null {
  const payload = (slide.payload ?? {}) as Record<string, unknown>;
  for (const slot of SLIDE_GRAF_SLOTS[slide.tipo] ?? []) {
    const g = comoObjeto(payload[slot]);
    if (typeof g.graficador === "string" && GRAFICADORES_CON_CIFRAS.has(g.graficador)) {
      return { graficador: g.graficador, args: comoObjeto(g.args) };
    }
  }
  return null;
}

const minuscula = (t: string): string => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const contiene = (a: string, b: string): boolean => a.toLocaleLowerCase("es").includes(b.toLocaleLowerCase("es"));
const empiezaCon = (a: string, b: string): boolean => a.toLocaleLowerCase("es").startsWith(b.toLocaleLowerCase("es"));

/** La regla en pocas palabras, para distinguir dos láminas del mismo gráfico; "" si toma todas (no distingue). */
export function reglaBreve(r: ReglaPreguntas | null): string {
  if (!r) return "";
  const n = formatoConteo(r.n ?? 10);
  const u = formatoConteo(r.umbral ?? REFERENCIA_POR_DEFECTO);
  switch (r.tipo) {
    case "bajo_umbral": return `escala bajo ${u}%`;
    case "mayor_sin_info": return `las ${n} con más Sin información`;
    case "mayor_diferencia": return `las ${n} de mayor diferencia`;
    case "diferencia_minima": return `diferencia de al menos ${u} puntos`;
    case "extremos": return `las ${n} más altas y las ${n} más bajas`;
    case "a_mano": return "preguntas elegidas a mano";
    default: return "";
  }
}

/** Los públicos de un gráfico: los `base$*` de `vars` y el par de `bases`, en su orden. */
function publicosDelGrafico(args: Readonly<Record<string, unknown>>): string[] {
  const bases = Array.isArray(args.bases) ? args.bases.filter((b): b is string => typeof b === "string" && b !== "") : [];
  return [...new Set([...publicosDe(args.vars), ...bases])];
}

/**
 * Cómo se nombra una lámina de origen (Q4-1 de la prueba con Arte): su título si el analista lo escribió; si no, lo que
 * la distingue de las demás láminas del mismo gráfico. «Lámina 26: Brechas, escala bajo 60%» (antetítulo y regla),
 * «Lámina 29: Fortalezas y alertas, docentes» (tarjeta y público, cuando el antetítulo sólo dice el público). Antes que
 * eso, el nombre que el mazo guardó en `meta.nombre` (F1).
 */
export function nombreDeOrigen(slide: Slide, numero: number, grafico: GraficadorRef | null): string {
  const titulo = tituloDeLamina(slide.payload);
  if (titulo) return `Lámina ${numero}: ${titulo}`;
  // F1: el nombre que el mazo le dio al insertarla (`meta.nombre`, con su público) manda, como en la Estructura.
  const delMazo = leerSlideMeta(slide).nombre;
  if (typeof delMazo === "string" && delMazo.trim()) return `Lámina ${numero}: ${nombreSinTitulo(slide)}`;
  const tarjeta = grafico ? presentacionDeGrafico(grafico.graficador, grafico.args ?? {}).nombre ?? "" : "";
  const ante = texto(leerSlideMeta(slide).antetitulo);
  const args = grafico?.args ?? {};
  const publicos = publicosDelGrafico(args);
  const enFrase = unirPublicos(publicos);
  const anteEsPublico = !!ante && !!enFrase && ante.toLocaleLowerCase("es") === enFrase.toLocaleLowerCase("es");
  const tipo = SLIDE_LABELS[slide.tipo] || slide.tipo;
  const cabeza = !ante || anteEsPublico ? tarjeta || ante || tipo : tarjeta && empiezaCon(tarjeta, ante) ? tarjeta : ante;
  const regla = reglaBreve(leerRegla(args.regla));
  const detalle = anteEsPublico
    ? enFrase
    : regla && !contiene(cabeza, regla)
      ? regla
      : cabeza === ante && tarjeta && !contiene(ante, tarjeta) ? minuscula(tarjeta) : "";
  return `Lámina ${numero}: ${detalle ? `${cabeza}, ${detalle}` : cabeza}`;
}

/** Las láminas del plan que publican cifras, en su orden (sin el cierre mismo ni otro cierre). */
export function origenesDelPlan(slides: readonly Slide[]): OrigenCifras[] {
  return slides.flatMap((s, i): OrigenCifras[] => {
    if (s.tipo === "p_slide_cierre_hallazgos") return [];
    const g = graficoConCifras(s);
    if (!g) return [];
    return [{ id: s.id, numero: i + 1, nombre: nombreDeOrigen(s, i + 1, g), graficador: g.graficador, args: g.args ?? {} }];
  });
}

/**
 * El aviso de una fila: sin origen, sin cifra (sólo cuando ya se leyeron las cifras de su lámina) o lo que le falta.
 * `cifras` es `null` mientras no hayan llegado.
 */
export function avisoHallazgo(h: HallazgoCierre, origenes: readonly OrigenCifras[], cifras: readonly CifraClave[] | null): string | null {
  if (!h.lamina) return h.cifra || h.texto ? "Falta elegir la cifra" : null;
  if (!origenes.some((o) => o.id === h.lamina)) return SIN_ORIGEN;
  if (!h.cifra) return "Falta elegir la cifra";
  if (cifras && !cifras.some((c) => c.clave === h.cifra)) return SIN_CIFRA;
  if (!h.texto) return "Falta la frase";
  return null;
}

/** La cifra elegida, con su unidad cuando la lámina la da por entendida (como la escribe la tarjeta del motor). */
export function cifraConUnidad(c: Pick<CifraClave, "texto" | "unidad">): string {
  return c.unidad && c.unidad !== "%" && !/%$/.test(c.texto) ? `${c.texto} ${c.unidad}` : c.texto;
}

/** Cambiar de lámina borra la cifra elegida (era de la otra). */
export function conLamina(h: HallazgoCierre, lamina: string): HallazgoCierre {
  return lamina === h.lamina ? h : { ...h, lamina, cifra: "", cifraAlEscribir: "" };
}

/** Elegir una cifra guarda también cómo se leía, para que el motor avise si cambia. */
export function conCifra(h: HallazgoCierre, cifra: CifraClave | null): HallazgoCierre {
  return cifra ? { ...h, cifra: cifra.clave, cifraAlEscribir: cifra.texto } : { ...h, cifra: "", cifraAlEscribir: "" };
}

/** Elegir en «Elegir cifra» fija la lámina y la cifra de una vez, con cómo se leía la cifra. */
export function conCifraDe(h: HallazgoCierre, lamina: string, cifra: CifraClave): HallazgoCierre {
  return conCifra(conLamina(h, lamina), cifra);
}

/**
 * La cifra cambió desde que se eligió (`cifra_al_escribir`): el mismo aviso que pone el motor en la lámina
 * (graficos_cierre_hallazgos.R). `null` si no se guardó cómo se leía o si todavía no llegó la de hoy.
 */
export function avisoCifraCambio(h: HallazgoCierre, hoy: Pick<CifraClave, "texto"> | null): string | null {
  if (!h.cifraAlEscribir || !hoy || hoy.texto === h.cifraAlEscribir) return null;
  return `La cifra cambió desde que se escribió el texto: era ${h.cifraAlEscribir} y hoy es ${hoy.texto}.`;
}

/** Cuántas filas tienen lámina presente, cifra y frase (la cifra que ya no está la avisa cada fila al leerla). */
export function completos(hs: readonly HallazgoCierre[], origenes: readonly OrigenCifras[]): number {
  return hs.filter((h) => !!h.lamina && avisoHallazgo(h, origenes, null) === null).length;
}

/** El aviso del conjunto: van de tres a cinco. */
export function avisoCantidad(n: number): string | null {
  if (n < MIN_HALLAZGOS) return `Van de ${MIN_HALLAZGOS} a ${MAX_HALLAZGOS} hallazgos; hay ${n}`;
  return null;
}

export function mover<T>(lista: readonly T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= lista.length) return [...lista];
  const out = [...lista];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
