// La ficha visual de una ranura (contrato de la maqueta, M1: «informa la naturaleza, no imita»; Gonzalo 2026-10-13):
// qué gráfico es, qué preguntas, qué públicos, con qué escala y con qué ajustes, y la forma que dibuja (filas reales por
// tema, bloques, columna Top Two Box). Puro: lo consume `geometriaFicha` y lo prueban los casos de la galería
// (docs/qa/maqueta-galeria-maquetas-2026-10-13.html).

import { esRespuestaResidual } from "../../estilo/modeloColoresRespuestas";
import type { OpcionesGlifo } from "../../iconos/glifosGrafico";
import { firmaOpciones } from "../../paletasResolver";
import { destacadasDe } from "../DestacarRespuestas";
import { GRAFICOS_CON_RESALTE, resaltaMayor } from "../ResaltarGrafico";
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
/** `btb`: la columna Bottom Two Box junto a la Top Two Box (recetario p79), en los bloques que la llevan. */
export type FormaBarras = { bloques: BloqueForma[]; eje: number; btb?: boolean };

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
  /** Lo que el glifo de los demás tipos refleja de sus ajustes (ítem 9 de la maqueta); vacío en las barras apiladas. */
  glifo: OpcionesGlifo;
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

/** Lector de un arg del slot o de sus overrides (los overrides mandan, como en el motor). */
function lectorArgs(args: Readonly<Record<string, unknown>>): (k: string) => unknown {
  const ov = (args.overrides && typeof args.overrides === "object" ? args.overrides : {}) as Record<string, unknown>;
  return (k: string) => (k in ov ? ov[k] : args[k]);
}

/** Ajustes que cualquier tipo puede llevar, leídos del slot o de sus overrides. */
function ajustesComunes(args: Readonly<Record<string, unknown>>): string[] {
  const v = lectorArgs(args);
  return [
    ...(v("mostrar_significancia") === true ? ["Diferencias significativas"] : []),
    // D3: el panel con o sin «172 respuestas» bajo su enunciado (sin decidir, la regla G9; no se nombra).
    ...(v("mostrar_publico") === true ? ["Con sus respuestas"] : v("mostrar_publico") === false ? ["Sin sus respuestas"] : []),
  ];
}

const entero = (x: unknown): number | null => {
  const n = Number(x);
  return x !== null && x !== "" && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};
const lista = (x: unknown): string[] => (Array.isArray(x) ? x : typeof x === "string" ? x.split(",") : []).map((t) => String(t).trim()).filter(Boolean);

const DESTACADO: Readonly<Record<string, string>> = {
  arriba_der: "arriba a la derecha", abajo_izq: "abajo a la izquierda", abajo_der: "abajo a la derecha",
};

/**
 * Ítem 9 de la maqueta: lo que el glifo de cada tipo refleja de sus ajustes y cómo se nombra en la ficha. Sólo lee args que
 * la lámina nativa dibuja (los RETIRADOS de argsDatosGrafico no salen) y usa el mismo valor por defecto que el registro
 * (`graficos_metadata.R`): un interruptor sin guardar dibuja lo que el motor dibuja.
 */
export function ajustesDelGlifo(graficador: string, args: Readonly<Record<string, unknown>>, grupos: boolean): { glifo: OpcionesGlifo; ajustes: string[] } {
  const v = lectorArgs(args);
  const glifo: OpcionesGlifo = { grupos, significancia: v("mostrar_significancia") === true };
  const ajustes: string[] = [];
  if (GRAFICOS_CON_RESALTE.has(graficador)) {
    // D1: las respuestas elegidas mandan sobre «la mayor» (como en la lámina nativa).
    const elegidas = destacadasDe(graficador, args);
    glifo.mayor = !elegidas.length && resaltaMayor(args as Record<string, unknown>);
    if (elegidas.length) { glifo.resaltar = true; ajustes.push(`Destacada: ${elegidas.join(", ")}`); }
    else if (glifo.mayor) ajustes.push("La mayor resaltada");
  }
  switch (graficador) {
    case "p_barras_agrupadas": {
      const max = entero(v("max_categorias"));
      if (max) ajustes.push(`Máximo ${max} categorías`);
      if (max && v("agrupar_resto_en_otros") !== false) { glifo.otros = true; ajustes.push("Resto en Otros"); }
      // Las marcas sólo se dibujan con la escala de 0 a 100 % (`usar_eje_libre` apagado, el defecto).
      if (v("marcas_eje") === true && v("usar_eje_libre") !== true) { glifo.marcas = true; ajustes.push("Marcas del eje"); }
      break;
    }
    case "p_pie":
    case "p_donut": {
      const k = entero(v("top_k"));
      if (k) { glifo.otros = true; ajustes.push(`Máximo ${k} categorías`, "Resto en Otros"); }
      // Recetario p70: la respuesta y la frase del centro de la dona.
      if (graficador === "p_donut" && typeof v("al_centro") === "string" && v("al_centro")) ajustes.push(`Al centro: ${v("al_centro") as string}`);
      if (graficador === "p_donut" && typeof v("frase_centro") === "string" && (v("frase_centro") as string).trim()) ajustes.push(`“${(v("frase_centro") as string).trim()}”`);
      break;
    }
    case "p_lollipop": {
      const n = entero(v("top_n"));
      if (n) { glifo.topN = n; ajustes.push(`Primeras ${n}`); }
      const destacadas = lista(v("resaltar"));
      if (destacadas.length) { glifo.resaltar = true; ajustes.push(`Destacada: ${destacadas.join(", ")}`); }
      break;
    }
    case "p_barras_divergentes":
      glifo.neutro = v("incluir_neutro") !== false;
      if (!glifo.neutro) ajustes.push("Sin el neutro partido");
      break;
    case "p_dumbbell":
      glifo.brecha = v("mostrar_brecha") !== false;
      if (!glifo.brecha) ajustes.push("Sin la brecha");
      break;
    case "p_serie_temporal":
      glifo.cifras = v("mostrar_valores") !== false;
      if (!glifo.cifras) ajustes.push("Sin cifras");
      break;
    case "p_radar":
      // `mostrar_tabla` depende de `modo = "publicos"` (registro): en los demás modos la tabla sale siempre.
      glifo.tabla = !(v("modo") === "publicos" && v("mostrar_tabla") === false);
      if (!glifo.tabla) ajustes.push("Sin tabla al costado");
      break;
    case "p_nube_palabras":
      glifo.ranking = v("mostrar_ranking") !== false;
      if (!glifo.ranking) ajustes.push("Sin ranking de palabras");
      break;
    case "p_matriz_cuadrantes": {
      const d = typeof v("destacado") === "string" ? (v("destacado") as string) : "arriba_izq";
      glifo.destacado = (["arriba_izq", "arriba_der", "abajo_izq", "abajo_der", "ninguno"].includes(d) ? d : "arriba_izq") as OpcionesGlifo["destacado"];
      if (glifo.destacado === "ninguno") ajustes.push("Sin cuadrante destacado");
      else if (DESTACADO[glifo.destacado as string]) ajustes.push(`Destacado ${DESTACADO[glifo.destacado as string]}`);
      break;
    }
    case "p_dim_heatmap":
      glifo.total = v("incluir_total") === true;
      if (glifo.total) ajustes.push("Columna Total");
      break;
    case "p_filtro_subpregunta": {
      const hab = lista(v("habilita"));
      if (hab.length) ajustes.push(`Habilita: ${hab.join(", ")}`);
      if (v("grafico_filtro") === "torta" || v("grafico_filtro") === "dona") ajustes.push(`Filtro en ${v("grafico_filtro") as string}`);
      else if (v("disposicion") === "abajo") ajustes.push("Subpregunta abajo");
      if (v("grafico_sub") === "escala") ajustes.push("Subpregunta en escala");
      break;
    }
    case "p_significancia_publicos": {
      const corte = lista(v("corte"));
      if (corte.length) ajustes.push(`Suman: ${corte.join(", ")}`);
      const a = Number(v("alpha"));
      if (Number.isFinite(a) && a > 0 && a !== 0.05) ajustes.push(`α = ${a}`);
      break;
    }
    case "p_tabla": {
      const u = entero(v("umbral_rojo_pct"));
      if (u) { glifo.rojo = true; ajustes.push(`En rojo bajo ${u} %`); }
      break;
    }
    default:
      break;
  }
  return { glifo, ajustes };
}

/** La ficha de una ranura. `nombreTipo`: el nombre visible del graficador (registro). */
export function fichaDeRanura(r: RanuraMaqueta, nombreTipo: string | null): FichaInfo {
  const base = { graficador: r.graficador, lectura: null, preguntas: [], publicos: [], leyendas: [], ajustes: [], avisos: [], forma: null, glifo: {} } as const;
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
    const propios = ajustesDelGlifo(r.graficador, r.args, !!cruceUno);
    return {
      graficador: r.graficador, tipo: tipoNombre, lectura: null, vacia: false, faltaPregunta: false, forma: null, glifo: propios.glifo,
      preguntas: r.preguntas.map((q) => q.titulo).filter(Boolean), publicos: r.bases, leyendas,
      ajustes: [...(r.twoBox.ttb ? ["Top Two Box"] : []), ...(cruceUno ? [`Por grupos: ${cruceUno}`] : []), ...ajustesComunes(r.args), ...propios.ajustes],
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
  const btb = conTtb > 0 && r.twoBox.btb && !ttbSinRespuestas;
  if (btb) ajustes.push("Bottom Two Box");
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
    forma: { bloques: salen, eje, btb },
    glifo: {},
    vacia: false,
    faltaPregunta: false,
  };
}
