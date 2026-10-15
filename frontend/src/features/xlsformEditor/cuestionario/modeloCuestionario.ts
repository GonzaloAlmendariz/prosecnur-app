// =============================================================================
// cuestionario/modeloCuestionario.ts — el formulario como documento de lectura
// =============================================================================
// «Vista del cuestionario» promete leer el formulario como lo verá la persona
// encuestada. Aquí se arma ese documento: secciones en orden, preguntas
// numeradas de corrido, sus opciones, las notas, las matrices (la misma
// detección que usa el Impreso) y la lógica en lenguaje llano: «Aparece si…»
// antes de la pregunta y, en la opción que la habilita, «→ P12».
//
// Las cifras (preguntas, minutos) usan la regla de `resumen/modeloResumen.ts`:
// una sola definición para Resumen y Cuestionario.
// =============================================================================

import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import type { BuilderNode, BuilderStructure, CatalogSummary } from "../types";
import { segundosDePregunta } from "../resumen/modeloResumen";

export type FormaRespuesta = "una" | "varias" | "numero" | "texto" | "fecha" | "hora" | "orden" | "acepta" | "otra";

export function formaDe(base: string): FormaRespuesta {
  switch (base) {
    case "select_one": return "una";
    case "select_multiple": return "varias";
    case "integer":
    case "decimal":
    case "range": return "numero";
    case "text": return "texto";
    case "date": return "fecha";
    case "time":
    case "datetime": return "hora";
    case "rank": return "orden";
    case "acknowledge": return "acepta";
    default: return "otra";
  }
}

export type OpcionDoc = { codigo: string; etiqueta: string; habilita: number[] };

export type PreguntaDoc = {
  nodo: BuilderNode;
  numero: number;
  forma: FormaRespuesta;
  opciones: OpcionDoc[];
  /** «Aparece si …», en lenguaje llano; null si aparece siempre. */
  condicion: string | null;
  /** Rango de un número, leído de la restricción (`. >= 1 and . <= 120`). */
  rango: { min: string | null; max: string | null } | null;
};

export type BloqueDoc =
  | { tipo: "pregunta"; pregunta: PreguntaDoc }
  | { tipo: "nota"; nodo: BuilderNode; condicion: string | null }
  | { tipo: "matriz"; clave: string; filas: PreguntaDoc[]; escala: OpcionDoc[] };

export type SeccionDoc = {
  clave: string;
  name: string;
  rotulo: string;
  repite: boolean;
  preguntas: number;
  segundos: number;
  conCondicion: number;
  bloques: BloqueDoc[];
};

// ── Lógica en lenguaje llano ────────────────────────────────────────────────

type Referencias = {
  numeroDe: ReadonlyMap<string, number>;
  etiquetaDe: (variable: string, codigo: string) => string | null;
};

function refDe(variable: string, refs: Referencias): string {
  const n = refs.numeroDe.get(variable);
  return n ? `P${n}` : variable;
}

function valorDe(variable: string, codigo: string, refs: Referencias): string {
  return `«${refs.etiquetaDe(variable, codigo) ?? codigo}»`;
}

/** Traduce una expresión `relevant` a una frase. Lo que no reconoce queda con las variables como P#. */
export function leerCondicion(expr: string, refs: Referencias): string {
  let r = expr.trim();
  if (!r) return "";
  r = r.replace(/not\s*\(\s*selected\(\s*\$\{([^}]+)\}\s*,\s*['"]?([^'")]+?)['"]?\s*\)\s*\)/g,
    (_, v: string, c: string) => `${refDe(v, refs)} no incluye ${valorDe(v, c, refs)}`);
  r = r.replace(/selected\(\s*\$\{([^}]+)\}\s*,\s*['"]?([^'")]+?)['"]?\s*\)/g,
    (_, v: string, c: string) => `${refDe(v, refs)} incluye ${valorDe(v, c, refs)}`);
  r = r.replace(/\$\{([^}]+)\}\s*!=\s*''/g, (_, v: string) => `${refDe(v, refs)} tiene respuesta`);
  r = r.replace(/\$\{([^}]+)\}\s*=\s*''/g, (_, v: string) => `${refDe(v, refs)} sin respuesta`);
  r = r.replace(/\$\{([^}]+)\}\s*=\s*'([^']*)'/g, (_, v: string, c: string) => `${refDe(v, refs)} es ${valorDe(v, c, refs)}`);
  r = r.replace(/\$\{([^}]+)\}\s*!=\s*'([^']*)'/g, (_, v: string, c: string) => `${refDe(v, refs)} no es ${valorDe(v, c, refs)}`);
  r = r.replace(/\$\{([^}]+)\}\s*(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)/g,
    (_, v: string, op: string, n: string) => `${refDe(v, refs)} ${({ ">=": "≥", "<=": "≤", ">": ">", "<": "<" } as Record<string, string>)[op]} ${n}`);
  r = r.replace(/\$\{([^}]+)\}/g, (_, v: string) => refDe(v, refs));
  r = r.replace(/\s+and\s+/g, " y ").replace(/\s+or\s+/g, " o ");
  return r.replace(/\s+/g, " ");
}

/** Pares (variable, código) que una condición exige: `${v} = 'c'` y `selected(${v}, 'c')`. */
export function codigosQueHabilitan(expr: string): { variable: string; codigo: string }[] {
  const pares: { variable: string; codigo: string }[] = [];
  const sinNegados = expr.replace(/not\s*\([^)]*\)\s*\)?/g, "");
  for (const m of sinNegados.matchAll(/selected\(\s*\$\{([^}]+)\}\s*,\s*['"]?([^'")]+?)['"]?\s*\)/g)) {
    pares.push({ variable: m[1], codigo: m[2] });
  }
  for (const m of sinNegados.matchAll(/\$\{([^}]+)\}\s*=\s*'([^']+)'/g)) {
    pares.push({ variable: m[1], codigo: m[2] });
  }
  return pares;
}

/** Rango de un número leído de su restricción; null si no hay ninguno reconocible. */
export function rangoDe(constraint: string): PreguntaDoc["rango"] {
  if (!constraint.trim()) return null;
  const min = /\.\s*>=?\s*(-?\d+(?:\.\d+)?)/.exec(constraint)?.[1] ?? null;
  const max = /\.\s*<=?\s*(-?\d+(?:\.\d+)?)/.exec(constraint)?.[1] ?? null;
  return min || max ? { min, max } : null;
}

// ── Documento ───────────────────────────────────────────────────────────────

const PREGUNTA_INICIAL: SeccionDoc = {
  clave: "inicio", name: "", rotulo: "Inicio del formulario", repite: false, preguntas: 0, segundos: 0, conCondicion: 0, bloques: [],
};

export function armarDocumento(
  structure: BuilderStructure | null,
  catalogos: readonly CatalogSummary[],
  matrices: readonly MatrixCandidate[],
): SeccionDoc[] {
  const outline = structure?.outline ?? [];
  const porLista = new Map(catalogos.map((c) => [c.listName, c.items]));
  const tamanoLista = new Map(catalogos.map((c) => [c.listName, c.items.length]));

  // Numeración de corrido: sólo las preguntas, como en el papel.
  const numeroDe = new Map<string, number>();
  let n = 0;
  for (const nodo of outline) if (nodo.kind === "question") numeroDe.set(nodo.name, ++n);

  const listaDe = new Map(outline.map((nodo) => [nodo.name, nodo.typeInfo.listName]));
  const refs: Referencias = {
    numeroDe,
    etiquetaDe: (variable, codigo) =>
      porLista.get(listaDe.get(variable) ?? "")?.find((o) => o.name === codigo)?.label ?? null,
  };

  // Qué opción habilita qué pregunta: «Si responde X → P12».
  const habilita = new Map<string, number[]>();
  for (const nodo of outline) {
    const destino = numeroDe.get(nodo.name);
    if (!destino || !nodo.relevant.trim()) continue;
    for (const { variable, codigo } of codigosQueHabilitan(nodo.relevant)) {
      const clave = `${variable}\u0000${codigo}`;
      habilita.set(clave, [...(habilita.get(clave) ?? []), destino]);
    }
  }

  const preguntaDe = (nodo: BuilderNode): PreguntaDoc => {
    const forma = formaDe(nodo.typeInfo.base);
    return {
      nodo,
      numero: numeroDe.get(nodo.name) ?? 0,
      forma,
      opciones: (porLista.get(nodo.typeInfo.listName) ?? []).map((o) => ({
        codigo: o.name,
        etiqueta: o.label || o.name,
        habilita: habilita.get(`${nodo.name}\u0000${o.name}`) ?? [],
      })),
      condicion: nodo.relevant.trim() ? leerCondicion(nodo.relevant, refs) : null,
      rango: forma === "numero" ? rangoDe(nodo.constraint) : null,
    };
  };

  // Matrices: las de 2+ preguntas, por su primer miembro.
  const matrizPorInicio = new Map<string, MatrixCandidate>();
  const enMatriz = new Set<string>();
  for (const m of matrices) {
    if (m.count < 2) continue;
    matrizPorInicio.set(m.memberNames[0], m);
    for (const name of m.memberNames) enMatriz.add(name);
  }

  const secciones: SeccionDoc[] = [];
  let actual: SeccionDoc = { ...PREGUNTA_INICIAL, bloques: [] };
  const cerrar = () => { if (actual.bloques.length > 0) secciones.push(actual); };

  outline.forEach((nodo, i) => {
    if (nodo.kind === "section" || nodo.kind === "repeat") {
      cerrar();
      actual = {
        clave: `${nodo.name || "seccion"}-${i}`,
        name: nodo.name,
        rotulo: nodo.label || nodo.name,
        repite: nodo.kind === "repeat",
        preguntas: 0,
        segundos: 0,
        conCondicion: 0,
        bloques: [],
      };
      return;
    }
    if (nodo.kind === "note") {
      actual.bloques.push({ tipo: "nota", nodo, condicion: nodo.relevant.trim() ? leerCondicion(nodo.relevant, refs) : null });
      return;
    }
    if (nodo.kind !== "question") return;
    actual.preguntas += 1;
    actual.segundos += segundosDePregunta(nodo, tamanoLista);
    if (nodo.relevant.trim()) actual.conCondicion += 1;
    const matriz = matrizPorInicio.get(nodo.name);
    if (matriz) {
      const filas = matriz.memberNames
        .map((name) => outline.find((o) => o.name === name))
        .filter((o): o is BuilderNode => Boolean(o))
        .map(preguntaDe);
      actual.bloques.push({ tipo: "matriz", clave: matriz.id, filas, escala: filas[0]?.opciones ?? [] });
      return;
    }
    if (enMatriz.has(nodo.name)) return;
    actual.bloques.push({ tipo: "pregunta", pregunta: preguntaDe(nodo) });
  });
  cerrar();
  return secciones;
}

/** Si casi todas son obligatorias, se marcan las opcionales (lo raro es lo que se señala). */
export function marcarOpcionales(preguntas: number, obligatorias: number): boolean {
  return preguntas > 0 && obligatorias / preguntas > 0.5;
}
