// Páginas de la vista Word del Informe (I11 del rediseño, 2026-10-14; decisión D2: el Word real sólo en la pestaña Word).
// Una maqueta, no el documento, pero con la MISMA numeración que el Word: recorre el plan como `.word_documento`
// (api/R/reporte_word_documento.R ~l.101–175) y su capítulo «Cómo leer» (reporte_word_como_leer.R ~l.69–143):
//   · los capítulos se renumeran con un contador propio (el número que traiga el título se descarta) al que también suman
//     «Introducción» (texto o tabla antes de la primera sección), «Cómo leer este informe» (si hay escalas, justo antes de
//     la primera sección de resultados) y «Resultados» (un gráfico sin capítulo de resultados todavía);
//   · las figuras se numeran de corrido y «Cómo leer» gasta las suyas (Top Two Box, Bottom Two Box si alguna escala lo
//     lleva, cifras pequeñas); las cifras destacadas van en franja y no son figuras;
//   · los títulos en mayúsculas pasan a tipo oración (`.word_oracion`).
// Puro; la vista arma los elementos desde el plan y lo dibuja. Verificador de la fase Informe (2026-10-15): la versión
// anterior numeraba con los números de la app y desde 1, y el Word real no.

import { ROTULO_COMO_LEER, type ClaveComoLeer } from "./comoLeerAuto";

export type ElementoWord =
  | { clase: "seccion"; nivel: 1 | 2; titulo: string; entrada?: string }
  | { clase: "texto"; titulo: string }
  | { clase: "tabla"; titulo: string }
  | { clase: "grafico"; graficador: string; pregunta: string; base: string | null }
  | { clase: "cifras" };

export type OpcionesWord = {
  tituloInforme: string; hayEscalas: boolean; hayBottom: boolean; comoLeer?: boolean; conTablas?: boolean;
  /** Modo automático (`comoLeer` ausente): secciones que calcula `comoLeerAuto`; vacío = el capítulo se omite. Un `comoLeer` explícito manda. */
  comoLeerAuto?: readonly ClaveComoLeer[];
  /** Subtítulo y fecha de la lámina de portada: la portada del Word los usa si Word › Portada no los cambia (W3). */
  portadaSub?: string; portadaFecha?: string;
};

export type FiguraWord = { numero: number; graficador: string; pregunta: string; base: string | null };
export type EntradaIndice = { numero: string; titulo: string; nivel: 1 | 2 };
/** `apertura`: la página que abre un capítulo (su número, título y entrada, como `.word_apertura`). */
type PaginaCapitulo = { clase: "capitulo"; encabezado: string; titulos: string[]; texto: boolean; figuras: FiguraWord[]; folio: number; apertura?: { numero: number; titulo: string; entrada: string } };

export type PaginaWord =
  | { clase: "portada"; titulo: string; sub: string; fecha: string }
  | { clase: "indice"; entradas: EntradaIndice[]; indices: string[]; folio: number }
  | { clase: "como-leer"; numero: number; secciones: string[]; figuras: number[]; folio: number }
  | PaginaCapitulo
  | { clase: "contraportada" };

// Calibrado con el Word real del catálogo (W8, 2026-10-15): 63 páginas reales; con 2 por página la maqueta estimaba 78,
// con 3 estima 59. Las figuras del Word se acomodan a la altura de la página.
const FIGURAS_POR_PAGINA = 3;
/** La apertura (número grande, título y entrada) ocupa un tercio de la página: debajo caben dos figuras. */
const FIGURAS_CON_APERTURA = 2;
/** Entradas del «Contenido» por página: más se salen de la página A4 (en el Word el índice también sigue en otra). */
export const ENTRADAS_POR_PAGINA = 18;   // medido: caben 20 dentro del margen de la página

/** `.word_oracion`: un título casi todo en mayúsculas pasa a tipo oración; uno ya mixto no se toca. */
export function oracion(texto: string): string {
  const x = texto.trim();
  const letras = x.replace(/[^\p{L}]/gu, "");
  if (letras.length < 4) return x;
  const minus = letras.replace(/[^\p{Ll}]/gu, "").length;
  if (minus > letras.length / 10) return x;
  const bajo = x.toLocaleLowerCase("es");
  return bajo.charAt(0).toLocaleUpperCase("es") + bajo.slice(1);
}

/** `.word_titulo_corto`: el que se dé o el título del informe cortado en la última palabra antes de 60 caracteres. */
export function tituloCortoWord(titulo: string, dado?: string, max = 60): string {
  if (dado?.trim()) return dado.trim();
  const t = oracion(titulo);
  if (t.length <= max) return t;
  const corte = t.slice(0, max).replace(/\s+\S*$/u, "");
  return `${corte.replace(/[,;:]$/u, "")}…`;
}

const sinNumero = (t: string) => oracion(t.replace(/^\s*\d+(?:\.\d+)*\.?\s+/u, ""));

export function paginasWord(elementos: readonly ElementoWord[], op: OpcionesWord): PaginaWord[] {
  const entradas: EntradaIndice[] = [];
  const paginas: PaginaWord[] = [
    { clase: "portada", titulo: op.tituloInforme, sub: op.portadaSub ?? "", fecha: op.portadaFecha ?? "" },
    { clase: "indice", entradas, indices: ["Índice de gráficos", ...(op.conTablas ? ["Índice de tablas"] : [])], folio: 2 },
  ];
  let folio = 3;
  let figura = 1;
  let cap = 0;
  let sec = 0;
  let capTitulo: string | null = null;
  const auto = op.comoLeer === undefined ? op.comoLeerAuto : undefined;
  let faltaComoLeer = auto ? auto.length > 0 : op.comoLeer ?? op.hayEscalas;
  let pagina: PaginaCapitulo | null = null;

  const nueva = (titulos: string[] = [], texto = false): PaginaCapitulo => {
    const p: PaginaCapitulo = { clase: "capitulo", encabezado: capTitulo ?? "", titulos, texto, figuras: [], folio: folio++ };
    paginas.push(p);
    pagina = p;
    return p;
  };
  const abrirCapitulo = (titulo: string, entrada = "") => {
    cap += 1; sec = 0; capTitulo = titulo;
    entradas.push({ numero: `${cap}.`, titulo, nivel: 1 });
    nueva([`${cap}. ${titulo}`]).apertura = { numero: cap, titulo, entrada };
  };
  const abrirIntro = () => { if (capTitulo === null) abrirCapitulo("Introducción"); };
  const ponerComoLeer = () => {
    if (!faltaComoLeer) return;
    faltaComoLeer = false;
    cap += 1; sec = 0; capTitulo = "Cómo leer este informe";
    entradas.push({ numero: `${cap}.`, titulo: capTitulo, nivel: 1 });
    const claves: readonly ClaveComoLeer[] = auto ?? ["top_two_box", ...(op.hayBottom ? ["bottom_two_box" as const] : []), "redondeo",
      "misma_escala", "cifras_pequenas", "bases_chicas"];
    const secciones = claves.map((k) => ROTULO_COMO_LEER[k]);
    const figuras = claves.filter((k) => k === "top_two_box" || k === "bottom_two_box" || k === "cifras_pequenas").map(() => figura++);   // TTB, BTB, cifras pequeñas
    paginas.push({ clase: "como-leer", numero: cap, secciones, figuras, folio: folio++ });
    pagina = null;
  };
  const subtitulo = (t: string) => {
    sec += 1;
    if (cap > 0) entradas.push({ numero: `${cap}.${sec}.`, titulo: t, nivel: 2 });
    return `${cap > 0 ? `${cap}.${sec}. ` : ""}${t}`;
  };
  /** Un título más: debajo del de la página si ésta todavía no tiene figuras ni texto; si no, en página nueva. */
  const titular = (t: string, texto: boolean) => {
    const actual = pagina as PaginaCapitulo | null;
    if (actual && !actual.figuras.length && !actual.texto) { actual.titulos.push(t); actual.texto = texto; } else nueva([t], texto);
  };

  for (const e of elementos) {
    if (e.clase === "seccion") {
      const titulo = sinNumero(e.titulo);
      if (e.nivel === 1) { ponerComoLeer(); abrirCapitulo(titulo, e.entrada ?? ""); } else titular(subtitulo(titulo), false);
      continue;
    }
    if (e.clase === "texto") { abrirIntro(); titular(subtitulo(oracion(e.titulo)), true); continue; }
    if (e.clase === "tabla") { abrirIntro(); continue; }
    if (e.clase === "cifras") continue;   // franja de cifras destacadas: no es una figura
    if (capTitulo === null || capTitulo === "Introducción" || capTitulo === "Cómo leer este informe") {
      ponerComoLeer();
      abrirCapitulo("Resultados");
    }
    let actual = pagina as PaginaCapitulo | null;
    if (!actual || actual.figuras.length >= (actual.apertura ? FIGURAS_CON_APERTURA : FIGURAS_POR_PAGINA) || (actual.texto && actual.figuras.length >= 1)) actual = nueva();
    actual.figuras.push({ numero: figura++, graficador: e.graficador, pregunta: e.pregunta, base: e.base });
  }
  paginas.push({ clase: "contraportada" });
  // El «Contenido» ocupa las páginas que necesite; las siguientes corren su folio.
  const partes = Math.max(1, Math.ceil(entradas.length / ENTRADAS_POR_PAGINA));
  const indices = paginas[1].clase === "indice" ? paginas[1].indices : [];
  const paginasIndice: PaginaWord[] = Array.from({ length: partes }, (_, k) => ({
    clase: "indice", entradas: entradas.slice(k * ENTRADAS_POR_PAGINA, (k + 1) * ENTRADAS_POR_PAGINA),
    indices: k === partes - 1 ? indices : [], folio: 2 + k,
  }));
  const resto = paginas.slice(2).map((p) => ("folio" in p ? { ...p, folio: p.folio + partes - 1 } : p));
  return [paginas[0], ...paginasIndice, ...resto];
}

export const contarFiguras = (paginas: readonly PaginaWord[]) =>
  paginas.reduce((t, p) => t + (p.clase === "capitulo" || p.clase === "como-leer" ? p.figuras.length : 0), 0);
