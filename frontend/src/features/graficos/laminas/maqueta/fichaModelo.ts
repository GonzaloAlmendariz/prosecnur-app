// La ficha visual de una ranura (contrato de la maqueta, M1: «informa la naturaleza, no imita»; Gonzalo 2026-10-13):
// qué gráfico es, qué preguntas, qué públicos, con qué escala y con qué ajustes, y la forma que dibuja (filas reales por
// tema, bloques, columna Top Two Box). Puro: lo consume `geometriaFicha` y lo prueban los casos de la galería
// (docs/qa/maqueta-galeria-maquetas-2026-10-13.html).

import { esRespuestaResidual } from "../../estilo/modeloColoresRespuestas";
import { firmaOpciones } from "../../paletasResolver";
import type { OpcionMaqueta, RanuraMaqueta } from "../modeloMaqueta";

/** Aviso de la ficha cuando el Top Two Box está encendido sin sus respuestas (el PowerPoint sale sin la columna). */
export const TTB_SIN_RESPUESTAS = "Top Two Box sin respuestas elegidas";

/** `.plan_particionar_escalas`: más barras y la escala sale en láminas «(cont.)». */
export const MAX_BARRAS = 7;

export type ItemLeyenda = { rotulo: string; color: string };
export type LeyendaFicha = { titulo: string | null; items: ItemLeyenda[] };
export type TemaForma = { filas: number };
export type BloqueForma = { titulo: string | null; colores: string[]; ttb: boolean; temas: TemaForma[] };
/** Lo que dibuja una ranura de barras apiladas; `null` en los demás tipos (usan su glifo). */
export type FormaBarras = { bloques: BloqueForma[]; eje: number };

export type FichaInfo = {
  graficador: string | null;
  /** Nombre del tipo («Multiapiladas», «Dicotómica»). */
  tipo: string;
  /** Sólo multiapiladas: la lectura («Públicos por tema», «Bloques»…). */
  lectura: string | null;
  preguntas: string[];
  publicos: string[];
  leyendas: LeyendaFicha[];
  ajustes: string[];
  avisos: string[];
  forma: FormaBarras | null;
  /** La ranura no tiene gráfico. */
  vacia: boolean;
  /** Tiene gráfico pero ninguna pregunta. */
  faltaPregunta: boolean;
};

const BARRAS = new Set(["p_barras_apiladas", "p_barras_multiapiladas"]);
const EJE_POR_DEFECTO = 0.22;

/**
 * Gris de una rampa de oscuro a claro para la respuesta `k` de `n` sin color asignado (M1b: «si no están asignados se
 * pone en escala de gris»). Las residuales, el más claro.
 */
export function gris(k: number, n: number, residual = false): string {
  const t = residual ? 1 : n <= 1 ? 0.5 : k / (n - 1);
  const v = Math.round(78 + t * (214 - 78));
  return `rgb(${v}, ${v + 3}, ${v + 10})`;
}

/** Los colores de una escala: el asignado, fiel, hasta 10; el resto en grises. */
export function coloresDeEscala(opciones: readonly OpcionMaqueta[]): string[] {
  const n = Math.min(opciones.length, 10);
  return opciones.map((o, k) => (o.color && k < 10 ? o.color : gris(Math.min(k, n - 1), n, esRespuestaResidual(o.rotulo))));
}

/** La lectura de multiapiladas, como la nombra su editor (`detectIntent` de MultiApiladasBuilder). */
export function lecturaMulti(args: Readonly<Record<string, unknown>>): string {
  if (args.modo === "multilista") return "Bloques";
  if (args.modo === "cruce") return "Una pregunta por grupos";
  if (args.modo === "var_cruce") return args.vars && typeof args.vars === "object" && !Array.isArray(args.vars) ? "Públicos por tema" : "Preguntas por grupos";
  return "Preguntas";
}

/** La forma de la primera lámina: temas completos hasta 7 barras; cuántas láminas salen en total. */
export function primeraParte(bloques: readonly BloqueForma[]): { bloques: BloqueForma[]; partes: number } {
  const total = bloques.reduce((a, b) => a + b.temas.reduce((x, t) => x + t.filas, 0), 0);
  if (total <= MAX_BARRAS) return { bloques: [...bloques], partes: 1 };
  let usadas = 0;
  const salen: BloqueForma[] = [];
  for (const b of bloques) {
    const temas: TemaForma[] = [];
    for (const t of b.temas) {
      if (usadas && usadas + t.filas > MAX_BARRAS) break;
      temas.push(t);
      usadas += t.filas;
    }
    if (temas.length) salen.push({ ...b, temas });
    if (temas.length < b.temas.length) break;
  }
  return { bloques: salen, partes: Math.ceil(total / Math.max(1, usadas)) };
}

/** `.MULTIACTOR_ANCHO_TEMA` (api/R/graficos_preset_multiactor.R): el ancho de la columna del tema que pide la lámina. */
const ANCHO_TEMA: Readonly<Record<string, number>> = { ancho: 0.28, angosto: 0.14 };

function ejeDe(args: Readonly<Record<string, unknown>>): number {
  const pedido = typeof args.ancho_tema === "string" ? ANCHO_TEMA[args.ancho_tema] : undefined;
  if (pedido) return pedido;
  const ov = (args.overrides && typeof args.overrides === "object" ? args.overrides : {}) as Record<string, unknown>;
  const w = Number(ov.canvas_w_grupo ?? args.canvas_w_grupo);
  return Number.isFinite(w) && w > 0 && w < 1 ? w : EJE_POR_DEFECTO;
}

/** Ajustes que cualquier tipo puede llevar, leídos del slot o de sus overrides. */
function ajustesComunes(args: Readonly<Record<string, unknown>>): string[] {
  const ov = (args.overrides && typeof args.overrides === "object" ? args.overrides : {}) as Record<string, unknown>;
  const v = (k: string) => (k in ov ? ov[k] : args[k]);
  return v("mostrar_significancia") === true ? ["Diferencias significativas"] : [];
}

/** La ficha de una ranura. `nombreTipo`: el nombre visible del graficador (registro). */
export function fichaDeRanura(r: RanuraMaqueta, nombreTipo: string | null): FichaInfo {
  const base = { graficador: r.graficador, lectura: null, preguntas: [], publicos: [], leyendas: [], ajustes: [], avisos: [], forma: null } as const;
  if (!r.graficador) return { ...base, tipo: "Elegir gráfico", vacia: true, faltaPregunta: false, preguntas: [], publicos: [], leyendas: [], ajustes: [], avisos: [] };
  const tipoNombre = nombreTipo ?? "Gráfico";
  if (!r.preguntas.length) return { ...base, tipo: tipoNombre, vacia: false, faltaPregunta: true, preguntas: [], publicos: [], leyendas: [], ajustes: [], avisos: [] };

  if (!BARRAS.has(r.graficador)) {
    // Los demás tipos: su glifo, sus preguntas, sus públicos y, si pintan por categoría, su escala.
    const q0 = r.preguntas[0];
    const leyendas = r.pinta === "categorias" && q0.opciones.length
      ? [{ titulo: null, items: q0.opciones.map((o, k) => ({ rotulo: o.rotulo, color: coloresDeEscala(q0.opciones)[k] })) }]
      : [];
    const cruceUno = q0.cruce;
    return {
      graficador: r.graficador, tipo: tipoNombre, lectura: null, vacia: false, faltaPregunta: false, forma: null,
      preguntas: r.preguntas.map((q) => q.titulo).filter(Boolean), publicos: r.bases, leyendas,
      ajustes: [...(r.twoBox.ttb ? ["Top Two Box"] : []), ...(cruceUno ? [`Por grupos: ${cruceUno}`] : []), ...ajustesComunes(r.args)],
      avisos: [],
    };
  }

  // Barras apiladas y multiapiladas: la forma por bloque y por tema.
  const nBloques = Math.max(1, ...r.preguntas.map((q) => q.bloque + 1));
  const bloquesForma: BloqueForma[] = Array.from({ length: nBloques }, (_, i) => {
    const qs = r.preguntas.filter((q) => q.bloque === i);
    const opciones = qs[0]?.opciones ?? [];
    return { titulo: r.bloques[i]?.titulo ?? null, colores: coloresDeEscala(opciones), ttb: qs.some((q) => q.ttb), temas: qs.map((q) => ({ filas: q.filas })) };
  }).filter((b) => b.temas.length);
  const { bloques: salen, partes } = primeraParte(bloquesForma);
  // La ficha describe la parte que se dibuja: sus preguntas y sus escalas; lo demás lo dice el aviso.
  const nTemas = salen.reduce((a, b) => a + b.temas.length, 0);
  const preguntasParte = r.preguntas.slice(0, nTemas);
  const escalas = new Map<string, { titulo: string | null; opciones: OpcionMaqueta[] }>();
  for (const q of preguntasParte) {
    const firma = firmaOpciones(q.opciones.map((o) => o.rotulo)) || `bloque-${q.bloque}`;
    if (!escalas.has(firma)) escalas.set(firma, { titulo: r.bloques[q.bloque]?.titulo ?? null, opciones: q.opciones });
  }
  const variasEscalas = escalas.size > 1;
  const leyendas: LeyendaFicha[] = [...escalas.values()].filter((e) => e.opciones.length).map((e) => ({
    titulo: variasEscalas ? e.titulo : null,
    items: e.opciones.map((o, k) => ({ rotulo: o.rotulo, color: coloresDeEscala(e.opciones)[k] })),
  }));
  const publicos = [...new Set(preguntasParte.flatMap((q) => q.bases))];
  const cruce = preguntasParte.find((q) => q.cruce)?.cruce ?? null;
  const ajustes: string[] = [];
  const conTtb = salen.filter((b) => b.ttb).length;
  // M2 (catálogo del recetario): sin respuestas elegidas el motor omite la columna y avisa; la ficha no la promete.
  const ttbSinRespuestas = conTtb > 0 && Array.isArray(r.twoBox.etiquetas) && r.twoBox.etiquetas.length === 0;
  if (conTtb) ajustes.push(conTtb === salen.length ? "Top Two Box" : "Top Two Box en un bloque");
  if (salen.length > 1) ajustes.push(`${salen.length} bloques`);
  if (cruce) ajustes.push(`Por grupos: ${cruce}`);
  ajustes.push(...ajustesComunes(r.args));
  const eje = ejeDe(r.args);
  // M3: el control vigente es `ancho_tema` («Más ancho», «Más angosto»); `canvas_w_grupo` es el de antes.
  if (r.args.ancho_tema === "ancho" || (r.args.ancho_tema !== "angosto" && eje >= 0.3)) ajustes.push("Temas anchos");
  else if (r.args.ancho_tema === "angosto") ajustes.push("Temas angostos");
  const ov = (r.args.overrides && typeof r.args.overrides === "object" ? r.args.overrides : {}) as Record<string, unknown>;
  if (publicos.length && (r.args.mostrar_respuestas === false || ov.mostrar_respuestas === false)) ajustes.push("Sin respuestas por público");
  const lectura = r.graficador === "p_barras_multiapiladas" ? lecturaMulti(r.args) : null;
  // Dicotómica: dos respuestas y, a lo más, una residual («No sabe»). Género, con «Prefiero no responder» y «Otro», no lo es.
  const unica = escalas.size === 1 ? [...escalas.values()][0].opciones : [];
  const dicotomica = unica.length >= 2 && unica.length <= 3 && unica.filter((o) => !esRespuestaResidual(o.rotulo)).length === 2;
  return {
    graficador: r.graficador,
    tipo: dicotomica && r.graficador === "p_barras_multiapiladas" ? "Dicotómica" : tipoNombre,
    lectura,
    preguntas: preguntasParte.map((q) => q.titulo).filter(Boolean),
    publicos,
    leyendas,
    ajustes,
    avisos: [...(ttbSinRespuestas ? [TTB_SIN_RESPUESTAS] : []), ...(partes > 1 ? [`Sale en ${partes} láminas`] : [])],
    forma: { bloques: salen, eje },
    vacia: false,
    faltaPregunta: false,
  };
}
