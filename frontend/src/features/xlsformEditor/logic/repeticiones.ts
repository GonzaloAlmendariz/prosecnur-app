// Repeticiones y grupos de una fila (S8, 2026-10-17): de qué `begin_repeat` cuelga una pregunta y cómo se nombra cada
// grupo en una frase. Funciones puras sobre la estructura; las usan el motor de lectura (indexed-repeat, sum, join),
// la ficha del Constructor («se repite por cada fila de ‹…›») y las condiciones heredadas.
//
// Un grupo se cita por su etiqueta. Si no la tiene, por lo que repite: una repetición sin etiqueta cuyo
// `repeat_count` es `count(${otra})` repite una fila por cada fila de esa otra repetición, y se nombra como ella.

import { stripMarkdown } from "../helpers/markdown";
import type { BuilderNode, BuilderStructure, SectionMeta } from "../types";
import type { LogicGroup, LogicScope } from "./builderTypes";

const limpiar = (s: string | undefined) => stripMarkdown(s ?? "").replace(/\s+/g, " ").trim();

const CUENTA_DE_OTRA = /^\s*count\s*\(\s*\$\{([^}]+)\}\s*\)\s*$/;

function seccionPorNombre(structure: BuilderStructure, name: string): SectionMeta | undefined {
  for (const meta of structure.sections.values()) if (meta.name === name && meta.kind !== "root") return meta;
  return undefined;
}

function repeatCountDe(structure: BuilderStructure, meta: SectionMeta): string {
  return meta.rowIndex != null ? (structure.byRow.get(meta.rowIndex)?.repeat_count ?? "").trim() : "";
}

/** Etiqueta con la que se cita un grupo o repetición; su código si no hay nada mejor. */
export function etiquetaDeGrupo(meta: SectionMeta, structure: BuilderStructure, vistos: Set<string> = new Set()): string {
  const propia = limpiar(meta.label);
  if (propia && propia !== meta.name) return propia;
  if (meta.kind === "repeat" && !vistos.has(meta.id)) {
    vistos.add(meta.id);
    const m = repeatCountDe(structure, meta).match(CUENTA_DE_OTRA);
    const otra = m ? seccionPorNombre(structure, m[1]!.trim()) : undefined;
    if (otra) return etiquetaDeGrupo(otra, structure, vistos);
  }
  return meta.name || propia;
}

export type Repeticion = { name: string; etiqueta: string; rowIndex: number | null };

/** Repeticiones que contienen la fila, de la más externa a la más interna. Vacío si no se repite. */
export function repeticionesDe(nodo: Pick<BuilderNode, "rowIndex" | "sectionId">, structure: BuilderStructure | null): Repeticion[] {
  if (!structure) return [];
  const out: Repeticion[] = [];
  const vistos = new Set<string>();
  let id: string | null = structure.rowToSectionId.get(nodo.rowIndex) ?? nodo.sectionId ?? null;
  while (id && !vistos.has(id)) {
    vistos.add(id);
    const meta = structure.sections.get(id);
    if (!meta || meta.kind === "root") break;
    if (meta.kind === "repeat") out.unshift({ name: meta.name, etiqueta: etiquetaDeGrupo(meta, structure), rowIndex: meta.rowIndex });
    id = meta.parentId;
  }
  return out;
}

/** «Se repite por cada fila de ‹Lista de los miembros del hogar›»; null si la fila no está en una repetición. */
export function textoSeRepite(nodo: Pick<BuilderNode, "rowIndex" | "sectionId">, structure: BuilderStructure | null): string | null {
  const reps = repeticionesDe(nodo, structure);
  const interna = reps[reps.length - 1];
  return interna ? `Se repite por cada fila de «${interna.etiqueta}»` : null;
}

/** Grupos y repeticiones del formulario, con la etiqueta con que se citan y el `repeat_count`. */
export function gruposDeEstructura(structure: BuilderStructure | null): LogicGroup[] {
  if (!structure) return [];
  const out: LogicGroup[] = [];
  for (const meta of structure.sections.values()) {
    if (meta.kind === "root" || !meta.name) continue;
    out.push({ name: meta.name, label: etiquetaDeGrupo(meta, structure), kind: meta.kind, repeatCount: repeatCountDe(structure, meta) || undefined });
  }
  return out;
}

const CACHE = new WeakMap<LogicScope, WeakMap<BuilderStructure, LogicScope>>();

/**
 * El alcance del motor con lo que sólo da la estructura: los grupos (para citar `${grupo}` por su etiqueta), la
 * repetición de cada variable (para leer sum/join/indexed-repeat «en todas las filas de ‹…›») y la fórmula de cada
 * cálculo (para nombrar un cálculo sin etiqueta que sólo copia otra respuesta). No muta el alcance recibido.
 */
export function enriquecerAlcance(scope: LogicScope, structure: BuilderStructure | null): LogicScope {
  if (!structure) return scope;
  const porScope = CACHE.get(scope) ?? new WeakMap<BuilderStructure, LogicScope>();
  const previo = porScope.get(structure);
  if (previo) return previo;
  const porNombre = new Map<string, BuilderNode>();
  for (const n of structure.outline) if (n.name && !porNombre.has(n.name)) porNombre.set(n.name, n);
  const variables = scope.variables.map((v) => {
    const n = porNombre.get(v.name);
    if (!n) return v;
    const reps = repeticionesDe(n, structure);
    const repeticion = reps[reps.length - 1]?.name;
    const calculation = n.calculation.trim() || undefined;
    return repeticion || calculation ? { ...v, ...(repeticion ? { repeticion } : {}), ...(calculation ? { calculation } : {}) } : v;
  });
  const out: LogicScope = { ...scope, variables, grupos: gruposDeEstructura(structure) };
  porScope.set(structure, out);
  CACHE.set(scope, porScope);
  return out;
}

export type CondicionHeredada = {
  /** Fila de apertura de la sección más interna que la declara. */
  nodo: BuilderNode;
  etiqueta: string;
  raw: string;
  /** Otras secciones que la contienen con la MISMA condición: se dice una vez, no una por sección. */
  tambien: string[];
};

/**
 * Condiciones que la fila hereda de sus secciones, de la más interna a la más externa, SIN repetir: dos secciones
 * anidadas con la misma condición (S4 dentro de S2 en el ACNUR) se leen una sola vez.
 */
export function condicionesHeredadas(nodo: Pick<BuilderNode, "rowIndex" | "sectionId">, structure: BuilderStructure | null): CondicionHeredada[] {
  if (!structure) return [];
  const out: CondicionHeredada[] = [];
  const vistos = new Set<string>();
  let id: string | null = structure.rowToSectionId.get(nodo.rowIndex) ?? nodo.sectionId ?? null;
  while (id && !vistos.has(id)) {
    vistos.add(id);
    const meta = structure.sections.get(id);
    if (!meta || meta.kind === "root") break;
    const apertura = meta.rowIndex != null ? structure.byRow.get(meta.rowIndex) : undefined;
    const raw = apertura?.relevant.trim() ?? "";
    if (apertura && apertura.rowIndex !== nodo.rowIndex && raw) {
      const etiqueta = etiquetaDeGrupo(meta, structure);
      const igual = out.find((c) => c.raw.replace(/\s+/g, "") === raw.replace(/\s+/g, ""));
      if (igual) igual.tambien.push(etiqueta);
      else out.push({ nodo: apertura, etiqueta, raw, tambien: [] });
    }
    id = meta.parentId;
  }
  return out;
}
