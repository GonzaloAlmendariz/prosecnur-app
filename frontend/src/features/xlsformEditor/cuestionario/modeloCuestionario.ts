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
import { esMetadato } from "../kit/tiposPregunta";
import { conReferencias, esNotaSinTexto } from "../helpers/markdownPregunta";

/**
 * Un texto que cita otra respuesta (`${HH01}`) se lee como en un cuestionario impreso: «[Nombre del miembro del hogar]»
 * con la etiqueta de esa pregunta si es corta, o «[HH01]» si no la tiene o es larga (S16: salía `${HH01}` crudo).
 * La regla vive en helpers/markdownPregunta.ts y la comparte Probar.
 */
export function conReferenciasLegibles(texto: string, etiquetaDe: (name: string) => string | undefined): string {
  return conReferencias(texto, { etiquetaDe });
}

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
  /** Fila del begin_group/begin_repeat (-1 en el inicio, que no es una sección del XLSForm). */
  fila: number;
  /** Sin título legible: vacío, igual al nombre o un rótulo de página importado («Pag1 (p1)»). */
  sinTitulo: boolean;
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

/**
 * Un título de sección que no le dice nada a quien lee: vacío, igual al `name` o el rótulo de página que deja la
 * importación («Pag1 (p1)», «Página 3»). En el corpus: 43 de 68 secciones en el tipo 1. No se inventa uno: se marca
 * y se deja escribir (M13, 2026-10-17).
 */
export function tituloTecnico(label: string, name: string): boolean {
  if ((label ?? "").trim() === name.trim()) return true;
  const t = (label ?? "").replace(/[*_#`]/g, "").trim();
  if (!t) return true;
  return /^p(a|á)g(ina)?\.?\s*\d+(\s*\([^)]*\))?$/i.test(t);
}

/** Rótulo del índice: nunca el código de la sección. Un rótulo vacío o igual al `name` se lee «Sección sin título» (S16). */
export function rotuloDeIndice(seccion: Pick<SeccionDoc, "rotulo" | "name">): string {
  const rotulo = (seccion.rotulo ?? "").trim();
  if (!rotulo || (seccion.name && rotulo === seccion.name.trim())) return "Sección sin título";
  return rotulo;
}

const PREGUNTA_INICIAL: SeccionDoc = {
  clave: "inicio", name: "", rotulo: "Inicio del formulario", fila: -1, sinTitulo: false, repite: false, preguntas: 0, segundos: 0, conCondicion: 0, bloques: [],
};

export function armarDocumento(
  structure: BuilderStructure | null,
  catalogos: readonly CatalogSummary[],
  matrices: readonly MatrixCandidate[],
): SeccionDoc[] {
  const outline = structure?.outline ?? [];
  const porLista = new Map(catalogos.map((c) => [c.listName, c.items]));
  const tamanoLista = new Map(catalogos.map((c) => [c.listName, c.items.length]));

  // Numeración de corrido: sólo las preguntas, como en el papel. Inicio, fin y demás automáticos los registra el
  // teléfono: no se numeran ni se muestran (S16: start y end salían como preguntas 1 y 2).
  // Matrices: las de 2+ preguntas, por su primer miembro.
  const matrizPorInicio = new Map<string, MatrixCandidate>();
  const enMatriz = new Set<string>();
  for (const m of matrices) {
    if (m.count < 2) continue;
    matrizPorInicio.set(m.memberNames[0], m);
    for (const name of m.memberNames) enMatriz.add(name);
  }

  // E6 (2026-10-20): se numera en el orden en que se lee y por fila, no por nombre. Una matriz pone juntas sus filas
  // donde aparece la primera, y un nombre repetido pisaba el número de su homónimo (salía 423 → 443 → 425).
  const filasDeMatriz = (m: MatrixCandidate, desde: number): BuilderNode[] => {
    const out: BuilderNode[] = [];
    for (const name of m.memberNames) {
      const o = outline.find((x, k) => k >= desde && x.name === name) ?? outline.find((x) => x.name === name);
      if (o) out.push(o);
    }
    return out;
  };
  const numeroPorFila = new Map<number, number>();
  const numeroDe = new Map<string, number>();
  let n = 0;
  const numerar = (o: BuilderNode) => {
    if (numeroPorFila.has(o.rowIndex)) return;
    numeroPorFila.set(o.rowIndex, ++n);
    if (!numeroDe.has(o.name)) numeroDe.set(o.name, n);
  };
  outline.forEach((nodo, i) => {
    if (nodo.kind !== "question" || esMetadato(nodo.typeInfo.base)) return;
    const matriz = matrizPorInicio.get(nodo.name);
    if (matriz) filasDeMatriz(matriz, i).forEach(numerar);
    else if (!enMatriz.has(nodo.name)) numerar(nodo);
  });
  const etiquetaDeNombre = new Map(outline.map((nodo) => [nodo.name, nodo.label]));
  const legible = (nodo: BuilderNode): BuilderNode =>
    nodo.label.includes("${") ? { ...nodo, label: conReferenciasLegibles(nodo.label, (x) => etiquetaDeNombre.get(x)) } : nodo;

  const listaDe = new Map(outline.map((nodo) => [nodo.name, nodo.typeInfo.listName]));
  const refs: Referencias = {
    numeroDe,
    etiquetaDe: (variable, codigo) =>
      porLista.get(listaDe.get(variable) ?? "")?.find((o) => o.name === codigo)?.label ?? null,
  };

  // Qué opción habilita qué pregunta: «Si responde X → P12».
  const habilita = new Map<string, number[]>();
  for (const nodo of outline) {
    const destino = numeroPorFila.get(nodo.rowIndex);
    if (!destino || !nodo.relevant.trim()) continue;
    for (const { variable, codigo } of codigosQueHabilitan(nodo.relevant)) {
      const clave = `${variable}\u0000${codigo}`;
      habilita.set(clave, [...(habilita.get(clave) ?? []), destino]);
    }
  }

  const preguntaDe = (nodo: BuilderNode): PreguntaDoc => {
    const forma = formaDe(nodo.typeInfo.base);
    return {
      nodo: legible(nodo),
      numero: numeroPorFila.get(nodo.rowIndex) ?? 0,
      forma,
      opciones: (porLista.get(nodo.typeInfo.listName) ?? []).map((o) => ({
        codigo: o.name,
        etiqueta: conReferenciasLegibles(o.label || o.name, (x) => etiquetaDeNombre.get(x)),
        habilita: habilita.get(`${nodo.name}\u0000${o.name}`) ?? [],
      })),
      condicion: nodo.relevant.trim() ? leerCondicion(nodo.relevant, refs) : null,
      rango: forma === "numero" ? rangoDe(nodo.constraint) : null,
    };
  };


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
        fila: nodo.rowIndex,
        sinTitulo: tituloTecnico(nodo.label, nodo.name),
        repite: nodo.kind === "repeat",
        preguntas: 0,
        segundos: 0,
        conCondicion: 0,
        bloques: [],
      };
      return;
    }
    if (nodo.kind === "note") {
      // Una nota sin texto (la imagen del logo) no se lee: no es un bloque del cuestionario.
      if (esNotaSinTexto(nodo)) return;
      actual.bloques.push({ tipo: "nota", nodo: legible(nodo), condicion: nodo.relevant.trim() ? leerCondicion(nodo.relevant, refs) : null });
      return;
    }
    if (nodo.kind !== "question" || esMetadato(nodo.typeInfo.base)) return;
    actual.preguntas += 1;
    actual.segundos += segundosDePregunta(nodo, tamanoLista);
    if (nodo.relevant.trim()) actual.conCondicion += 1;
    const matriz = matrizPorInicio.get(nodo.name);
    if (matriz) {
      const filas = filasDeMatriz(matriz, i).map(preguntaDe);
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
