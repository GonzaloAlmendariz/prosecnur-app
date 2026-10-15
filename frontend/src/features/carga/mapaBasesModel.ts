/**
 * Mapa de bases (checklist OIGD 2026-10-15, G1): qué tiene cada base y qué le
 * falta frente a las otras.
 *
 * Todo sale de lo que la pestaña ya leyó: la matriz tal como se ve (con sus
 * cambios sin guardar, que son los que «Añadir a la matriz» acaba de hacer) y
 * el catálogo de variables por base. No se pide nada al backend.
 *
 * Una variable está «en la matriz» si alguna fila la nombra en esa base, como
 * pregunta o como componente de un indicador compuesto (ADR 0105).
 */

import type { EquivalenciaFila, VariableDeBase } from "../../api/equivalencias";
import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { filtrarPreguntas } from "./preguntaEquivalenteModel";

/**
 * `?panel=mapa-bases`. Con `foco=<base>` muestra las variables de esa base que
 * no están en ninguna fila de la matriz.
 */
export const PANEL_MAPA_BASES: PanelDeclarado = {
  id: "mapa-bases",
  label: "Mapa de bases",
  clase: "sideover",
};

type FilaMatriz = Pick<EquivalenciaFila, "variables" | "derivada" | "armonizacion" | "etiqueta_estandar">;

/** Variables de una base que alguna fila nombra. */
export function variablesEnMatriz(filas: readonly FilaMatriz[], base: string): Set<string> {
  const out = new Set<string>();
  for (const f of filas) {
    const v = f.variables[base];
    if (v) out.add(v);
    for (const c of f.derivada?.por_base[base]?.variables ?? []) if (c) out.add(c);
  }
  return out;
}

export type ResumenDeBase = {
  base: string;
  /** Variables del instrumento de la base, según el catálogo. */
  total: number;
  enMatriz: number;
  fuera: number;
};

export function resumenPorBase(
  bases: readonly string[],
  filas: readonly FilaMatriz[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
): ResumenDeBase[] {
  return bases.map((base) => {
    const catalogo = variablesPorBase[base] ?? [];
    const usadas = variablesEnMatriz(filas, base);
    const enMatriz = catalogo.filter((v) => usadas.has(v.name)).length;
    return { base, total: catalogo.length, enMatriz, fuera: catalogo.length - enMatriz };
  });
}

export type PresenciaEnBase = "presente" | "falta" | "no-comparable";

/**
 * Cómo está una fila en una base. «No comparable» es una decisión declarada en
 * la armonización y pesa más que tener la pregunta.
 */
export function presenciaEnBase(fila: FilaMatriz, base: string): PresenciaEnBase {
  const tiene = Boolean(fila.variables[base]) || Boolean(fila.derivada?.por_base[base]?.variables.length);
  if (!tiene) return "falta";
  return fila.armonizacion?.por_base[base]?.comparable === false ? "no-comparable" : "presente";
}

export type FilaDelMapa = {
  /** Posición en la tabla de la matriz. */
  posicion: number;
  etiqueta: string;
  porBase: { base: string; presencia: PresenciaEnBase; variable: string }[];
  /** Falta en alguna base. */
  incompleta: boolean;
};

export function filasDelMapa(bases: readonly string[], filas: readonly FilaMatriz[]): FilaDelMapa[] {
  return filas
    .map((f, posicion) => {
      const porBase = bases.map((base) => ({
        base,
        presencia: presenciaEnBase(f, base),
        variable: f.variables[base] ?? "",
      }));
      return {
        posicion,
        etiqueta: f.etiqueta_estandar.trim(),
        porBase,
        incompleta: porBase.some((p) => p.presencia === "falta"),
      };
    })
    .filter((f) => f.porBase.some((p) => p.presencia !== "falta"));
}

/** Variables de la base que ninguna fila nombra, filtradas por la búsqueda, en el orden del instrumento. */
export function variablesFuera(
  base: string,
  filas: readonly FilaMatriz[],
  variablesPorBase: Record<string, readonly VariableDeBase[]>,
  consulta = "",
): VariableDeBase[] {
  const usadas = variablesEnMatriz(filas, base);
  const fuera = (variablesPorBase[base] ?? []).filter((v) => !usadas.has(v.name));
  return filtrarPreguntas(fuera, consulta);
}

/**
 * Metadatos y control del levantamiento (identificadores, fechas, consentimientos,
 * filtro de entrada): existen en la base pero nadie los compara entre mediciones.
 * Se listan aparte, plegados, para que lo primero que se vea sean las preguntas.
 */
const METADATO_RE =
  /^(_?uuid|_?id|_index|_parent_index|_submission\w*|_submitted_by|_status|_validation_status|_notes|_tags|__version__|instanceid|deviceid|collectorid|start|end|today|date|fecha\w*|consent\w*|consentimiento\w*|filtro|primer_ciclo)$/i;

export function esMetadato(v: Pick<VariableDeBase, "name">): boolean {
  return METADATO_RE.test(v.name.trim());
}

/** Separa preguntas y metadatos conservando el orden del instrumento. */
export function separarMetadatos(vars: readonly VariableDeBase[]): {
  preguntas: VariableDeBase[];
  metadatos: VariableDeBase[];
} {
  const preguntas: VariableDeBase[] = [];
  const metadatos: VariableDeBase[] = [];
  for (const v of vars) (esMetadato(v) ? metadatos : preguntas).push(v);
  return { preguntas, metadatos };
}

// ---- Textos ---------------------------------------------------------------------

export function textoFaltaEn(filas: readonly FilaDelMapa[]): string {
  const n = filas.filter((f) => f.incompleta).length;
  if (n === 0) return "Todas están en todas las bases.";
  return n === 1 ? "1 falta en alguna base." : `${n} faltan en alguna base.`;
}
