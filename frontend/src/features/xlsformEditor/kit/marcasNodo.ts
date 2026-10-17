// Marcas de una pregunta para el riel «Señales» (2026-10-17): qué sabe el formulario de cada fila, en el orden fijo
// del riel (obligatoria, condición, restricción, cálculo, filtro). Modelo puro: lee el nodo, su estructura y, si se
// tiene, el `required` crudo de la fila (el nodo sólo guarda un booleano y una expresión cae como «no»).
// No traduce reglas: eso lo hace el motor (reglas/leerRegla.ts) cuando se abre el panel.

import { lecturaRequired } from "../parsing/parseType";
import type { BuilderNode, BuilderStructure } from "../types";
import type { ClaveMarca } from "./glifosMarca";

export type CasillaRiel = "oblig" | "cond" | "regla" | "calc" | "filtro";

/** Orden fijo del riel: nunca cambia de una fila a otra. */
export const RIEL: readonly CasillaRiel[] = ["oblig", "cond", "regla", "calc", "filtro"];

export type MarcaOblig = { siempre: true } | { siempre: false; raw: string };

/** Condición de una sección o repetición que contiene a la fila. */
export type CondHeredada = { nodo: BuilderNode; etiqueta: string; raw: string };

export type MarcasNodo = {
  oblig: MarcaOblig | null;
  /** `relevant` propio de la fila. */
  cond: string | null;
  /** Condiciones de las secciones que la contienen, de la más cercana a la más externa. */
  hered: CondHeredada[];
  regla: { raw: string; mensaje: string | null } | null;
  calc: string | null;
  filtro: { raw: string; lista: string } | null;
};

function obligDe(node: BuilderNode, requiredRaw: string | undefined): MarcaOblig | null {
  if (requiredRaw === undefined) return node.required ? { siempre: true } : null;
  const lectura = lecturaRequired(requiredRaw);
  if (lectura === "siempre") return { siempre: true };
  if (lectura === "nunca") return null;
  return { siempre: false, raw: requiredRaw.trim() };
}

function heredadas(node: BuilderNode, structure: BuilderStructure | null | undefined): CondHeredada[] {
  if (!structure) return [];
  const out: CondHeredada[] = [];
  const vistos = new Set<string>();
  // La fila de apertura de una sección pertenece a la sección que la contiene (buildIndex), así que su propia
  // condición nunca se cuenta como heredada.
  let id: string | null = structure.rowToSectionId.get(node.rowIndex) ?? node.sectionId ?? null;
  while (id && !vistos.has(id)) {
    vistos.add(id);
    const meta = structure.sections.get(id);
    if (!meta || meta.kind === "root") break;
    const apertura = meta.rowIndex != null ? structure.byRow.get(meta.rowIndex) : undefined;
    if (apertura && apertura.rowIndex !== node.rowIndex && apertura.relevant.trim()) {
      out.push({ nodo: apertura, etiqueta: apertura.label || apertura.name || meta.label, raw: apertura.relevant.trim() });
    }
    id = meta.parentId;
  }
  return out;
}

export function marcasNodo(node: BuilderNode, structure?: BuilderStructure | null, requiredRaw?: string): MarcasNodo {
  const constraint = node.constraint.trim();
  const mensaje = (node.constraint_message ?? "").trim();
  const filtro = node.choiceFilter.trim();
  return {
    oblig: obligDe(node, requiredRaw),
    cond: node.relevant.trim() || null,
    hered: heredadas(node, structure),
    // Un mensaje que repite el nombre de la variable es una fila rota del instrumento, no un mensaje.
    regla: constraint ? { raw: constraint, mensaje: mensaje && mensaje !== node.name ? mensaje : null } : null,
    calc: node.calculation.trim() || null,
    filtro: filtro ? { raw: filtro, lista: node.typeInfo.listName || "" } : null,
  };
}

export function tieneCasilla(m: MarcasNodo, k: CasillaRiel): boolean {
  switch (k) {
    case "oblig":
      return m.oblig !== null;
    case "cond":
      return m.cond !== null || m.hered.length > 0;
    case "regla":
      return m.regla !== null;
    case "calc":
      return m.calc !== null;
    case "filtro":
      return m.filtro !== null;
  }
}

/** La casilla SI muestra la condición heredada (en contorno) cuando la fila no tiene una propia. */
export function claveVisible(m: MarcasNodo, k: CasillaRiel): ClaveMarca {
  return k === "cond" && m.cond === null && m.hered.length > 0 ? "hered" : k;
}

export type InfoMarca = { nombre: string; tono: string; corto: string };

export const INFO_MARCA: Readonly<Record<ClaveMarca, InfoMarca>> = {
  oblig: { nombre: "Obligatoria", tono: "var(--pulso-marca-oblig)", corto: "OB" },
  cond: { nombre: "Condición propia", tono: "var(--pulso-marca-cond)", corto: "SI" },
  hered: { nombre: "Condición de la sección", tono: "var(--pulso-marca-cond)", corto: "SI" },
  regla: { nombre: "Restricción", tono: "var(--pulso-marca-regla)", corto: "RE" },
  calc: { nombre: "Cálculo", tono: "var(--pulso-marca-calc)", corto: "ƒx" },
  filtro: { nombre: "Filtro de opciones", tono: "var(--pulso-marca-filtro)", corto: "FI" },
  repite: { nombre: "Se repite", tono: "var(--pulso-marca-repite)", corto: "" },
};

/** Lo que dice una casilla vacía: un rótulo y una línea. */
export const VACIO_MARCA: Readonly<Record<CasillaRiel, readonly [string, string]>> = {
  oblig: ["Opcional", "Se puede dejar en blanco."],
  cond: ["Aparece siempre", "No depende de otra respuesta."],
  regla: ["Sin restricción", "Acepta cualquier valor de su tipo."],
  calc: ["No es un cálculo", "La responde el encuestado."],
  filtro: ["Sin filtro", "Muestra todas sus opciones."],
};
