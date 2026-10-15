// Páginas de la vista Word del Informe (I11 del rediseño, 2026-10-14; decisión D2: el Word real sólo en la pestaña Word).
// Una maqueta, no el documento: arma la secuencia de páginas con la convención del recetario Word que sigue el motor
// (`reporte_word_documento.R`): portada, «Contenido», un título numerado por capítulo con su encabezado corrido, cada
// gráfico como «Gráfico N» con su pregunta encima y la base al pie, y la contraportada. Puro; la vista lo dibuja.

import type { FilaVistaGeneral } from "./modeloVistaGeneral";

export type FiguraWord = { numero: number; graficador: string; pregunta: string; base: string | null };
export type EntradaIndice = { numero: string; titulo: string; nivel: 1 | 2 };

export type PaginaWord =
  | { clase: "portada"; titulo: string }
  | { clase: "indice"; entradas: EntradaIndice[]; folio: number }
  | { clase: "texto"; titulo: string; encabezado: string; folio: number }
  | { clase: "graficos"; encabezado: string; titulos: string[]; figuras: FiguraWord[]; folio: number }
  | { clase: "contraportada" };

/** Lo que el Word saca de cada lámina con gráficos: un tipo y una pregunta por gráfico, en el orden de sus ranuras. */
export type GraficosDeLamina = ReadonlyMap<string, readonly { graficador: string; pregunta: string; base?: string | null }[]>;

const FIGURAS_POR_PAGINA = 2;

export function paginasWord(filas: readonly FilaVistaGeneral[], graficos: GraficosDeLamina, tituloInforme: string): PaginaWord[] {
  const paginas: PaginaWord[] = [{ clase: "portada", titulo: tituloInforme }];
  const capitulos = filas.filter((f) => f.clase === "capitulo");
  const entradas: EntradaIndice[] = [];
  for (const c of capitulos) {
    entradas.push({ numero: `${c.numero ?? ""}.`, titulo: c.titulo, nivel: 1 });
    for (const t of c.tarjetas) {
      if (t.rol === "subcapitulo" && t.numero) entradas.push({ numero: `${t.numero}.`, titulo: t.lamina.titulo, nivel: 2 });
    }
  }
  let folio = 2;
  if (entradas.length) paginas.push({ clase: "indice", entradas, folio: folio++ });

  let n = 0;
  for (const fila of filas) {
    if (fila.clase !== "capitulo") {
      // «Cómo leer este informe» sí entra al Word como texto; Apertura y Cierre son la portada y la contraportada.
      if (/c[oó]mo leer/i.test(fila.titulo)) paginas.push({ clase: "texto", titulo: fila.titulo, encabezado: fila.titulo, folio: folio++ });
      continue;
    }
    const encabezado = `${fila.numero ? `${fila.numero}. ` : ""}${fila.titulo}`;
    let pendientes: FiguraWord[] = [];
    let titulos: string[] = [encabezado];
    const cerrar = () => {
      if (!pendientes.length && !titulos.length) return;
      paginas.push({ clase: "graficos", encabezado: fila.titulo, titulos, figuras: pendientes, folio: folio++ });
      pendientes = [];
      titulos = [];
    };
    for (const t of fila.tarjetas) {
      if (t.rol === "subcapitulo") {
        // Un subcapítulo abre página, salvo que la página sólo tenga títulos: entonces va debajo del del capítulo.
        if (pendientes.length) cerrar();
        titulos.push(`${t.numero ? `${t.numero}. ` : ""}${t.lamina.titulo}`);
        continue;
      }
      for (const g of graficos.get(t.lamina.id) ?? []) {
        if (pendientes.length === FIGURAS_POR_PAGINA) cerrar();
        pendientes.push({ numero: ++n, graficador: g.graficador, pregunta: g.pregunta, base: g.base ?? null });
      }
    }
    cerrar();
  }
  paginas.push({ clase: "contraportada" });
  return paginas;
}

export const contarFiguras = (paginas: readonly PaginaWord[]) =>
  paginas.reduce((t, p) => t + (p.clase === "graficos" ? p.figuras.length : 0), 0);
