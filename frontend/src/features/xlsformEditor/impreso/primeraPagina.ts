// La primera página real del cuestionario para «Así queda» (L36 de la maqueta de Meta B, sin DOC.0). El esquema de
// página dibujaba barras grises: servía para ver columnas y cabecera, no para decidir. Ahora lleva el título y las
// primeras preguntas imprimibles con su número, su enunciado y sus opciones, en baja resolución y al instante. El PDF
// exacto sigue siendo «Previsualizar».

import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { stripMarkdown } from "../helpers/markdown";
import { esCierre, esMetadato } from "../kit/tiposPregunta";
import { extractChoiceItems } from "../parsing/buildIndex";
import type { BuilderStructure } from "../types";

export type PreguntaDePagina = {
  numero: string;
  texto: string;
  /** `circulo` para selección única, `cuadro` para múltiple, `linea` para respuesta escrita. */
  marca: "circulo" | "cuadro" | "linea";
  opciones: string[];
  /** Opciones que no se dibujan: la página dice «y N más». */
  restantes: number;
};

export type PrimeraPagina = { titulo: string; preguntas: PreguntaDePagina[] };

/** Más que esto no cabe en una página A4 ni a una columna angosta. */
const TOPE_PREGUNTAS = 14;
const TOPE_OPCIONES = 5;

export function tituloDelFormulario(workbook: Pick<XlsformEditorWorkbook, "settings">): string {
  const i = workbook.settings.columns.indexOf("form_title");
  return i < 0 ? "" : (workbook.settings.rows[0]?.[i] ?? "").trim();
}

export function primeraPagina(
  workbook: Pick<XlsformEditorWorkbook, "settings" | "choices">,
  structure: Pick<BuilderStructure, "outline"> | null,
): PrimeraPagina {
  const preguntas: PreguntaDePagina[] = [];
  let correlativo = 0;
  for (const nodo of structure?.outline ?? []) {
    if (preguntas.length >= TOPE_PREGUNTAS) break;
    // Lo que no sale en papel: secciones (son títulos), cálculos, metadatos y cierres.
    if (nodo.kind !== "question" && nodo.kind !== "note") continue;
    const base = nodo.typeInfo.base;
    if (esMetadato(base) || esCierre(base)) continue;
    if ((nodo.paperSkip ?? "").trim().toLowerCase() === "yes") continue;
    const texto = stripMarkdown(nodo.paperLabel || nodo.label || nodo.name).trim();
    if (!texto) continue;
    const esNota = nodo.kind === "note";
    if (!esNota) correlativo += 1;
    const lista = nodo.typeInfo.listName
      ? extractChoiceItems(workbook.choices, nodo.typeInfo.listName).map((o) => stripMarkdown(o.label || o.name).trim()).filter(Boolean)
      : [];
    preguntas.push({
      numero: esNota ? "" : (nodo.paperNumber || String(correlativo)),
      texto,
      marca: base === "select_multiple" ? "cuadro" : lista.length > 0 ? "circulo" : "linea",
      opciones: lista.slice(0, TOPE_OPCIONES),
      restantes: Math.max(0, lista.length - TOPE_OPCIONES),
    });
  }
  return { titulo: tituloDelFormulario(workbook), preguntas };
}

/**
 * Parte un texto en líneas de a lo más `porLinea` caracteres, sin cortar palabras, y lo recorta con «…» si pasa de
 * `maxLineas`. El SVG no envuelve texto: esto es lo que hace que un enunciado largo quepa en su columna.
 */
export function partirEnLineas(texto: string, porLinea: number, maxLineas: number): string[] {
  const palabras = texto.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (candidata.length <= porLinea || !actual) {
      actual = candidata.length > porLinea ? `${candidata.slice(0, porLinea - 1)}…` : candidata;
      continue;
    }
    lineas.push(actual);
    actual = palabra.length > porLinea ? `${palabra.slice(0, porLinea - 1)}…` : palabra;
    if (lineas.length === maxLineas) break;
  }
  if (lineas.length < maxLineas && actual) lineas.push(actual);
  const sobra = lineas.join(" ").replace(/…$/, "").length < palabras.join(" ").length;
  if (sobra && lineas.length) {
    const ultima = lineas[lineas.length - 1]!;
    lineas[lineas.length - 1] = ultima.endsWith("…") ? ultima : `${ultima.slice(0, Math.max(1, porLinea - 1))}…`;
  }
  return lineas.slice(0, maxLineas);
}
