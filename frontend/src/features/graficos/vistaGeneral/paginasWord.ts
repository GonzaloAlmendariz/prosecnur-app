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

export type ElementoWord =
  | { clase: "seccion"; nivel: 1 | 2; titulo: string }
  | { clase: "texto"; titulo: string }
  | { clase: "tabla"; titulo: string }
  | { clase: "grafico"; graficador: string; pregunta: string; base: string | null }
  | { clase: "cifras" };

export type OpcionesWord = { tituloInforme: string; hayEscalas: boolean; hayBottom: boolean; comoLeer?: boolean; conTablas?: boolean };

export type FiguraWord = { numero: number; graficador: string; pregunta: string; base: string | null };
export type EntradaIndice = { numero: string; titulo: string; nivel: 1 | 2 };
type PaginaCapitulo = { clase: "capitulo"; encabezado: string; titulos: string[]; texto: boolean; figuras: FiguraWord[]; folio: number };

export type PaginaWord =
  | { clase: "portada"; titulo: string }
  | { clase: "indice"; entradas: EntradaIndice[]; indices: string[]; folio: number }
  | { clase: "como-leer"; numero: number; secciones: string[]; figuras: number[]; folio: number }
  | PaginaCapitulo
  | { clase: "contraportada" };

const FIGURAS_POR_PAGINA = 2;
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

const sinNumero = (t: string) => oracion(t.replace(/^\s*\d+(?:\.\d+)*\.?\s+/u, ""));

export function paginasWord(elementos: readonly ElementoWord[], op: OpcionesWord): PaginaWord[] {
  const entradas: EntradaIndice[] = [];
  const paginas: PaginaWord[] = [
    { clase: "portada", titulo: op.tituloInforme },
    { clase: "indice", entradas, indices: ["Índice de gráficos", ...(op.conTablas ? ["Índice de tablas"] : [])], folio: 2 },
  ];
  let folio = 3;
  let figura = 1;
  let cap = 0;
  let sec = 0;
  let capTitulo: string | null = null;
  let faltaComoLeer = op.comoLeer ?? op.hayEscalas;
  let pagina: PaginaCapitulo | null = null;

  const nueva = (titulos: string[] = [], texto = false): PaginaCapitulo => {
    const p: PaginaCapitulo = { clase: "capitulo", encabezado: capTitulo ?? "", titulos, texto, figuras: [], folio: folio++ };
    paginas.push(p);
    pagina = p;
    return p;
  };
  const abrirCapitulo = (titulo: string) => {
    cap += 1; sec = 0; capTitulo = titulo;
    entradas.push({ numero: `${cap}.`, titulo, nivel: 1 });
    nueva([`${cap}. ${titulo}`]);
  };
  const abrirIntro = () => { if (capTitulo === null) abrirCapitulo("Introducción"); };
  const ponerComoLeer = () => {
    if (!faltaComoLeer) return;
    faltaComoLeer = false;
    cap += 1; sec = 0; capTitulo = "Cómo leer este informe";
    entradas.push({ numero: `${cap}.`, titulo: capTitulo, nivel: 1 });
    const secciones = ["Top Two Box", ...(op.hayBottom ? ["Bottom Two Box"] : []), "Redondeo de las cifras",
      "Una misma escala, muchas redacciones", "Cifras muy pequeñas", "Bases chicas e información faltante"];
    const figuras = [figura++, ...(op.hayBottom ? [figura++] : []), figura++];   // TTB, BTB, cifras pequeñas
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
      if (e.nivel === 1) { ponerComoLeer(); abrirCapitulo(titulo); } else titular(subtitulo(titulo), false);
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
    if (!actual || actual.figuras.length >= FIGURAS_POR_PAGINA || (actual.texto && actual.figuras.length >= 1)) actual = nueva();
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
