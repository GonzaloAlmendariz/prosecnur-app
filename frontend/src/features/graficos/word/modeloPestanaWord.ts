// Pestaña Word en cinco partes (W1 del rediseño, 2026-10-15): Documento, Portada, Capítulos, Gráficos y Cierre, cada una
// con la página del documento que la muestra. Puro: elige esa página entre las maquetas de `paginasWord` (I11) y dice en
// una línea lo que hoy hace el Word en esa parte, contado sobre las páginas (no un texto fijo).

import type { PaginaWord } from "../vistaGeneral/paginasWord";

export type ParteWord = "documento" | "portada" | "capitulos" | "graficos" | "cierre";

export const PARTES_WORD: readonly { key: ParteWord; label: string }[] = [
  { key: "documento", label: "Documento" },
  { key: "portada", label: "Portada" },
  { key: "capitulos", label: "Capítulos" },
  { key: "graficos", label: "Gráficos" },
  { key: "cierre", label: "Cierre" },
];

/** La página que muestra cada parte: el contenido, la portada, la apertura de un capítulo, una página con gráficos y la
 *  contraportada. `null` si el documento no la tiene (p. ej. un plan sin gráficos). */
export function paginaDeParte(paginas: readonly PaginaWord[], parte: ParteWord): PaginaWord | null {
  const primera = (f: (p: PaginaWord) => boolean) => paginas.find(f) ?? null;
  switch (parte) {
    case "documento": return primera((p) => p.clase === "indice");
    case "portada": return primera((p) => p.clase === "portada");
    // La apertura de un capítulo del plan (no la «Introducción» que el Word arma con los textos previos).
    case "capitulos": return primera((p) => p.clase === "capitulo" && !!p.apertura && p.apertura.titulo !== "Introducción") ?? primera((p) => p.clase === "capitulo");
    case "graficos": return primera((p) => p.clase === "capitulo" && p.figuras.length > 0);
    case "cierre": return primera((p) => p.clase === "contraportada");
  }
}

/** Una línea por parte, para el menú: lo que el documento tiene ahí. */
export function resumenDeParte(paginas: readonly PaginaWord[], parte: ParteWord): string {
  const capitulos = new Set(paginas.flatMap((p) => (p.clase === "capitulo" && p.encabezado ? [p.encabezado] : []))).size;
  const figuras = paginas.reduce((n, p) => n + (p.clase === "capitulo" || p.clase === "como-leer" ? p.figuras.length : 0), 0);
  // El contenido se parte en varias páginas y sólo una trae los índices de gráficos y tablas: se juntan todos.
  const indices = [...new Set(paginas.flatMap((p) => (p.clase === "indice" ? p.indices : [])))];
  const hayContenido = paginas.some((p) => p.clase === "indice");
  const comoLeer = paginas.some((p) => p.clase === "como-leer");
  switch (parte) {
    // O9: sin punto medio ni comillas angulares.
    case "documento": return [hayContenido ? (indices.length ? "Contenido e índices" : "Contenido") : "", comoLeer ? "Cómo leer" : ""].filter(Boolean).join(" y ") || "Sin índices";
    case "portada": return "Título y logos";
    case "capitulos": return capitulos === 1 ? "1 capítulo" : `${capitulos} capítulos`;
    case "graficos": return figuras === 1 ? "1 gráfico" : `${figuras} gráficos`;
    case "cierre": return "Contraportada con logos";
  }
}
