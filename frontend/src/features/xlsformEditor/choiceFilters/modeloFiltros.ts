// Modelo de diagnóstico y vista previa de «Filtros de opciones» (E5, 2026-10-20). Lógica pura, sin React.
//
// Dado el workbook (estructura del survey y hoja choices) y una pregunta con choice_filter, dice:
//   - de qué forma es el filtro (cascada, por opción, fijo o expresión) y cómo se edita;
//   - qué opciones ve el encuestado para un juego de respuestas de las preguntas de las que depende;
//   - qué opciones no se muestran nunca, qué respuestas dejan la lista vacía y qué columnas no existen en choices.
//
// La evaluación recorre el árbol del parser de lectura (los nombres sueltos son columnas de choices, `call "@campo"`).
// Lo que no sabe evaluar (funciones, `.`) deja el filtro sin vista previa: nunca adivina.

import type { XlsformEditorSheet } from "../../../api/multiIntegrado";
import type { BuilderNode, BuilderStructure } from "../types";
import { parseExpressionLectura, type Expr } from "../logic";
import { esRellenoDeFilaRota } from "../reglas/motor/filaRota";
import { textoPreguntaPlano } from "../helpers/markdownPregunta";
import { humanizeLabel } from "./buildChoiceFilterModel";
import { leerPorOpcion, type LecturaPorOpcion } from "./porOpcion";

export type TipoFiltro = "cascada" | "opcion" | "fijo" | "expresion";

export const NOMBRE_TIPO: Record<TipoFiltro, string> = {
  cascada: "Cascada",
  opcion: "Por opción",
  fijo: "Fijo",
  expresion: "Expresión",
};

/** Una opción de la lista, sin repetir (la forma vieja del filtro por opción repite una fila por respuesta). */
export type OpcionLista = { codigo: string; etiqueta: string; filas: number[] };

export type Respuesta = { codigo: string; etiqueta: string };

/** Una pregunta de la que depende el filtro. `respuestas` es null si no se pueden enumerar (cálculo, texto). */
export type Entrada = {
  nombre: string;
  etiqueta: string;
  fila: number | null;
  multiple: boolean;
  lista: string;
  respuestas: Respuesta[] | null;
};

/** Respuesta dada a cada entrada: un código, o varios si la pregunta es de opción múltiple. */
export type Respuestas = Record<string, string | string[]>;

export type FormaCascada = "igual" | "marcada" | "incluye";
export type LecturaCascada = { madre: string; columna: string; forma: FormaCascada; siempre: string[] };
export type LecturaFijo = { forma: "columna"; columna: string; valor: string } | { forma: "nombres"; codigos: string[] };

export type Diagnostico =
  | { clase: "conflicto"; columna: string; sugerida: string | null }
  | { clase: "rota" }
  | { clase: "vacia"; entrada: string; respuestas: string[] }
  | { clase: "nunca"; opciones: string[]; arreglo: { columna: string; cambios: { de: string; a: string }[] } | null };

export type ClaseEstado = "ok" | "nunca" | "vacia" | "conflicto" | "sin-vista";
export type Estado = { clase: ClaseEstado; texto: string };

export type AnalisisFiltro = {
  fila: number;
  pregunta: string;
  etiqueta: string;
  baseType: string;
  lista: string;
  expresion: string;
  tipo: TipoFiltro;
  cascada: LecturaCascada | null;
  porOpcion: LecturaPorOpcion | null;
  fijo: LecturaFijo | null;
  entradas: Entrada[];
  opciones: OpcionLista[];
  /** Columnas de choices que nombra la expresión (sin `name`). */
  columnas: string[];
  /** Otras preguntas con la misma lista cuyo filtro usa alguna de esas columnas: editar las celdas también las cambia. */
  compartidaCon: string[];
  evaluable: boolean;
  diagnosticos: Diagnostico[];
  estado: Estado;
};

export type EntradaModelo = { structure: BuilderStructure | null; choices: XlsformEditorSheet };

const COLUMNAS_SIEMPRE = new Set(["name", "list_name", "label"]);
const MAX_COMBINACIONES = 2000;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const limpiarComillas = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

/** Título de una pregunta como lo lee el encuestado: sin markdown y sin `${x}` crudo. */
export function tituloDePregunta(nodo: Pick<BuilderNode, "label" | "name">, porNombre: ReadonlyMap<string, BuilderNode>): string {
  const plano = textoPreguntaPlano(nodo.label || nodo.name, { etiquetaDe: (n) => porNombre.get(n)?.label });
  return humanizeLabel(plano) || nodo.name;
}

export function mapaPorNombre(structure: BuilderStructure | null): Map<string, BuilderNode> {
  const m = new Map<string, BuilderNode>();
  for (const n of structure?.outline ?? []) if (n.name && !m.has(n.name)) m.set(n.name, n);
  return m;
}

export function esPreguntaDeSeleccion(n: BuilderNode): boolean {
  return n.kind === "question" && !!n.typeInfo.listName && !n.typeInfo.listName.includes("${") && /^select_(one|multiple)$/.test(n.typeInfo.base);
}

// ── Hoja choices ────────────────────────────────────────────────────────────

function indiceEtiqueta(columnas: readonly string[]): number {
  const i = columnas.indexOf("label");
  return i >= 0 ? i : columnas.findIndex((c) => c.startsWith("label"));
}

/** Opciones de una lista en su orden, sin repetir, con las filas de choices de cada una. Una etiqueta con `${x}` se lee
 *  como «[Etiqueta de x]» (o «[x]»), nunca cruda. */
export function opcionesDe(choices: XlsformEditorSheet, lista: string, etiquetaDe: (name: string) => string | undefined = () => undefined): OpcionLista[] {
  const iL = choices.columns.indexOf("list_name");
  const iN = choices.columns.indexOf("name");
  const iE = indiceEtiqueta(choices.columns);
  if (iL < 0 || iN < 0 || !lista) return [];
  const porCodigo = new Map<string, OpcionLista>();
  choices.rows.forEach((r, k) => {
    if ((r[iL] ?? "").trim() !== lista) return;
    const codigo = (r[iN] ?? "").trim();
    const previa = porCodigo.get(codigo);
    if (previa) previa.filas.push(k);
    else porCodigo.set(codigo, { codigo, etiqueta: humanizeLabel(textoPreguntaPlano(iE >= 0 ? r[iE] ?? "" : "", { etiquetaDe })) || codigo, filas: [k] });
  });
  return [...porCodigo.values()];
}

// ── Lectura de formas ───────────────────────────────────────────────────────

const COL = String.raw`([A-Za-z_][\w.-]*)`;
const REF = String.raw`\$\{\s*([^}\s]+)\s*\}`;
const T_IGUAL = new RegExp(String.raw`^\(?\s*${COL}\s*=\s*${REF}\s*\)?$`);
const T_MARCADA = new RegExp(String.raw`^\(?\s*selected\(\s*${REF}\s*,\s*${COL}\s*\)\s*\)?$`);
const T_INCLUYE = new RegExp(String.raw`^\(?\s*selected\(\s*${COL}\s*,\s*${REF}\s*\)\s*\)?$`);
const T_NAME = /^\(?\s*name\s*=\s*['"]([^'"]*)['"]\s*\)?$/;

/** `col = ${madre}`, `selected(${madre}, col)` o `selected(col, ${madre})`, con opciones fijas `or name = 'x'`. */
export function leerCascada(expr: string): LecturaCascada | null {
  const texto = limpiarComillas((expr ?? "").trim());
  if (!texto || /\band\b/.test(texto)) return null;
  let base: Omit<LecturaCascada, "siempre"> | null = null;
  const siempre: string[] = [];
  for (const parte of texto.split(/\s+or\s+/)) {
    const p = parte.trim();
    const n = T_NAME.exec(p);
    if (n) { siempre.push(n[1]); continue; }
    if (base) return null;
    const i = T_IGUAL.exec(p);
    if (i && i[1] !== "name") { base = { columna: i[1], madre: i[2], forma: "igual" }; continue; }
    const m = T_MARCADA.exec(p);
    if (m) { base = { madre: m[1], columna: m[2], forma: "marcada" }; continue; }
    const c = T_INCLUYE.exec(p);
    if (c && c[1] !== "name") { base = { columna: c[1], madre: c[2], forma: "incluye" }; continue; }
    return null;
  }
  return base ? { ...base, siempre } : null;
}

/** `col = 'v'` (las marcadas con v en una columna) o `name = 'a' or name = 'b'` (opciones nombradas). */
export function leerFijo(expr: string): LecturaFijo | null {
  const texto = limpiarComillas((expr ?? "").trim());
  const nombres: string[] = [];
  const partes = texto.split(/\s+or\s+/);
  if (partes.every((p) => { const n = T_NAME.exec(p.trim()); if (n) nombres.push(n[1]); return !!n; })) {
    return nombres.length ? { forma: "nombres", codigos: nombres } : null;
  }
  const m = /^\(?\s*([A-Za-z_][\w.-]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|(-?\d+(?:\.\d+)?))\s*\)?$/.exec(texto);
  if (!m || m[1] === "name") return null;
  return { forma: "columna", columna: m[1], valor: m[2] ?? m[3] ?? m[4] ?? "" };
}

function tipoDe(expr: string, rota: boolean): { tipo: TipoFiltro; cascada: LecturaCascada | null; porOpcion: LecturaPorOpcion | null; fijo: LecturaFijo | null } {
  const nada = { cascada: null, porOpcion: null, fijo: null };
  if (rota) return { tipo: "expresion", ...nada };
  const po = leerPorOpcion(expr);
  if (po && new Set(po.terminos.map((t) => t.pregunta)).size >= 2) return { tipo: "opcion", ...nada, porOpcion: po };
  const c = leerCascada(expr);
  if (c) return { tipo: "cascada", ...nada, cascada: c };
  const f = leerFijo(expr);
  if (f) return { tipo: "fijo", ...nada, fijo: f };
  return { tipo: "expresion", ...nada };
}

// ── Evaluación ──────────────────────────────────────────────────────────────

type Valor = string | string[] | boolean;
type Contexto = { celda: (columna: string) => string; respuesta: (nombre: string) => string | string[] };

const campo = (e: Expr | undefined): string | null =>
  e?.kind === "call" && e.name === "@campo" && e.args[0]?.kind === "literal" ? String(e.args[0].value) : null;

/** ¿Sabe el modelo evaluar este árbol contra una fila de choices? */
export function soportada(e: Expr): boolean {
  switch (e.kind) {
    case "ref":
    case "literal":
      return true;
    case "compare":
      return soportada(e.left) && soportada(e.right);
    case "logical":
      return e.operands.every(soportada);
    case "not":
      return soportada(e.operand);
    case "call":
      if (campo(e) !== null) return true;
      return e.name === "selected" && e.args.length === 2 && e.args.every(soportada);
    default:
      return false;
  }
}

const texto = (v: Valor): string => (Array.isArray(v) ? v.join(" ") : typeof v === "boolean" ? String(v) : v);
const fichas = (v: Valor): string[] => (Array.isArray(v) ? v : texto(v).split(/\s+/).filter(Boolean));
const numero = (s: string): number | null => (/^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : null);

function valor(e: Expr, ctx: Contexto): Valor | null {
  switch (e.kind) {
    case "ref":
      return ctx.respuesta(e.name);
    case "literal":
      return typeof e.value === "boolean" ? e.value : String(e.value);
    case "call": {
      const col = campo(e);
      if (col !== null) return ctx.celda(col);
      if (e.name === "selected" && e.args.length === 2) {
        const a = valor(e.args[0]!, ctx);
        const b = valor(e.args[1]!, ctx);
        if (a === null || b === null) return null;
        return fichas(a).includes(texto(b).trim());
      }
      return null;
    }
    case "compare": {
      const a = valor(e.left, ctx);
      const b = valor(e.right, ctx);
      if (a === null || b === null) return null;
      const ta = texto(a).trim();
      const tb = texto(b).trim();
      const na = numero(ta);
      const nb = numero(tb);
      switch (e.op) {
        case "=": return na !== null && nb !== null ? na === nb : ta === tb;
        case "!=": return na !== null && nb !== null ? na !== nb : ta !== tb;
        case "<": return na !== null && nb !== null ? na < nb : null;
        case ">": return na !== null && nb !== null ? na > nb : null;
        case "<=": return na !== null && nb !== null ? na <= nb : null;
        case ">=": return na !== null && nb !== null ? na >= nb : null;
        default: return null;
      }
    }
    case "logical": {
      const vs = e.operands.map((o) => valor(o, ctx));
      if (vs.some((v) => v === null)) return null;
      const bs = vs.map((v) => (typeof v === "boolean" ? v : texto(v!).trim() !== ""));
      return e.op === "and" ? bs.every(Boolean) : bs.some(Boolean);
    }
    case "not": {
      const v = valor(e.operand, ctx);
      return v === null ? null : !(typeof v === "boolean" ? v : texto(v).trim() !== "");
    }
    default:
      return null;
  }
}

function verdadero(e: Expr, ctx: Contexto): boolean | null {
  const v = valor(e, ctx);
  if (v === null) return null;
  return typeof v === "boolean" ? v : texto(v).trim() !== "";
}

function refsDe(e: Expr, out: Set<string> = new Set()): Set<string> {
  if (e.kind === "ref") out.add(e.name);
  else if (e.kind === "compare") { refsDe(e.left, out); refsDe(e.right, out); }
  else if (e.kind === "logical") e.operands.forEach((o) => refsDe(o, out));
  else if (e.kind === "not") refsDe(e.operand, out);
  else if (e.kind === "call") e.args.forEach((a) => refsDe(a, out));
  return out;
}

function columnasDe(e: Expr, out: Set<string> = new Set()): Set<string> {
  const c = campo(e);
  if (c !== null) out.add(c);
  else if (e.kind === "compare") { columnasDe(e.left, out); columnasDe(e.right, out); }
  else if (e.kind === "logical") e.operands.forEach((o) => columnasDe(o, out));
  else if (e.kind === "not") columnasDe(e.operand, out);
  else if (e.kind === "call") e.args.forEach((a) => columnasDe(a, out));
  return out;
}

const tieneCampo = (e: Expr) => columnasDe(e).size > 0;

function contextoDeFila(choices: XlsformEditorSheet, fila: number, respuestas: Respuestas): Contexto {
  const r = choices.rows[fila] ?? [];
  return {
    celda: (col) => {
      const i = choices.columns.indexOf(col);
      return i < 0 ? "" : (r[i] ?? "").trim();
    },
    respuesta: (n) => respuestas[n] ?? "",
  };
}

function visibleCon(ast: Expr, choices: XlsformEditorSheet, o: OpcionLista, respuestas: Respuestas): boolean | null {
  let incierto = false;
  for (const f of o.filas) {
    const v = verdadero(ast, contextoDeFila(choices, f, respuestas));
    if (v === true) return true;
    if (v === null) incierto = true;
  }
  return incierto ? null : false;
}

function arbolDe(expr: string): Expr | null {
  const ast = parseExpressionLectura(limpiarComillas(expr.trim()));
  return ast && ast.kind !== "raw" ? ast : null;
}

/** Códigos de las opciones que ve el encuestado con estas respuestas; null si el filtro no se puede previsualizar. */
export function opcionesVisibles(a: Pick<AnalisisFiltro, "expresion" | "opciones" | "evaluable">, choices: XlsformEditorSheet, respuestas: Respuestas): string[] | null {
  if (!a.evaluable) return null;
  const ast = arbolDe(a.expresion);
  if (!ast) return null;
  const out: string[] = [];
  for (const o of a.opciones) {
    const v = visibleCon(ast, choices, o, respuestas);
    if (v === null) return null;
    if (v) out.push(o.codigo);
  }
  return out;
}

/** Juegos de respuestas posibles para estas entradas (una por pregunta; las múltiples, de a una). null si son demasiados. */
function combinaciones(nombres: readonly string[], entradas: ReadonlyMap<string, Entrada>): Respuestas[] | null {
  let juegos: Respuestas[] = [{}];
  for (const n of nombres) {
    const e = entradas.get(n);
    if (!e?.respuestas?.length) return null;
    if (juegos.length * e.respuestas.length > MAX_COMBINACIONES) return null;
    juegos = juegos.flatMap((j) => e.respuestas!.map((r) => ({ ...j, [n]: e.multiple ? [r.codigo] : r.codigo })));
  }
  return juegos;
}

/** ¿Hay alguna respuesta con la que la opción se muestra? null si no se puede saber. Un `or` se mira por partes. */
function alcanzable(e: Expr, choices: XlsformEditorSheet, o: OpcionLista, entradas: ReadonlyMap<string, Entrada>): boolean | null {
  if (e.kind === "logical" && e.op === "or") {
    const rs = e.operands.map((x) => alcanzable(x, choices, o, entradas));
    if (rs.includes(true)) return true;
    return rs.every((r) => r === false) ? false : null;
  }
  const juegos = combinaciones([...refsDe(e)], entradas);
  if (!juegos) return null;
  let incierto = false;
  for (const j of juegos) {
    const v = visibleCon(e, choices, o, j);
    if (v === true) return true;
    if (v === null) incierto = true;
  }
  return incierto ? null : false;
}

// ── Diagnóstico ─────────────────────────────────────────────────────────────

const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Una columna de choices que casi seguro es la que quiso nombrar: igual sin mayúsculas ni signos, o la única que empieza igual. */
export function columnaParecida(falta: string, columnas: readonly string[]): string | null {
  const candidatas = columnas.filter((c) => !COLUMNAS_SIEMPRE.has(c) && !c.startsWith("label"));
  const n = normal(falta);
  if (!n) return null;
  const iguales = candidatas.filter((c) => normal(c) === n);
  if (iguales.length === 1) return iguales[0]!;
  const prefijo = candidatas.filter((c) => normal(c).startsWith(n) || n.startsWith(normal(c)));
  return prefijo.length === 1 ? prefijo[0]! : null;
}

/** Para cada código huérfano de la cascada, la única respuesta de la madre que se le parece (o null si no hay arreglo seguro). */
function arregloDeCodigos(huerfanos: readonly string[], madre: Entrada | undefined): { de: string; a: string }[] | null {
  if (!madre?.respuestas?.length || !huerfanos.length) return null;
  const cambios: { de: string; a: string }[] = [];
  for (const de of huerfanos) {
    const n = normal(de);
    if (!n) return null;
    const exactas = madre.respuestas.filter((r) => normal(r.codigo) === n || normal(r.etiqueta) === n);
    const cerca = exactas.length
      ? exactas
      : madre.respuestas.filter((r) => normal(r.codigo).startsWith(n) || n.startsWith(normal(r.codigo)) || normal(r.etiqueta).startsWith(n));
    if (cerca.length !== 1) return null;
    cambios.push({ de, a: cerca[0]!.codigo });
  }
  return cambios;
}

function textoEstado(clase: ClaseEstado, ds: readonly Diagnostico[]): string {
  if (clase === "conflicto") return "En conflicto";
  if (clase === "sin-vista") return "Sin vista previa";
  if (clase === "vacia") {
    const n = ds.reduce((s, d) => s + (d.clase === "vacia" ? d.respuestas.length : 0), 0);
    return `Lista vacía con ${plural(n, "respuesta", "respuestas")}`;
  }
  if (clase === "nunca") {
    const n = ds.reduce((s, d) => s + (d.clase === "nunca" ? d.opciones.length : 0), 0);
    return n === 1 ? "1 opción nunca visible" : `${n} opciones nunca visibles`;
  }
  return "Sin problemas";
}

function estadoDe(ds: readonly Diagnostico[], evaluable: boolean, sinOpciones = false): Estado {
  const clase: ClaseEstado = ds.some((d) => d.clase === "conflicto" || d.clase === "rota")
    ? "conflicto"
    : ds.some((d) => d.clase === "vacia")
      ? "vacia"
      : ds.some((d) => d.clase === "nunca")
        ? "nunca"
        : evaluable ? "ok" : "sin-vista";
  return { clase, texto: clase === "sin-vista" && sinOpciones ? "Lista sin opciones" : textoEstado(clase, ds) };
}

/** Otras preguntas con la misma lista cuyo filtro nombra alguna de estas columnas. */
function quienesComparten(structure: BuilderStructure, nodo: BuilderNode, columnas: readonly string[]): string[] {
  const propias = columnas.filter((c) => !COLUMNAS_SIEMPRE.has(c));
  if (!propias.length) return [];
  const out: string[] = [];
  for (const n of structure.outline) {
    if (n.rowIndex === nodo.rowIndex || !n.choiceFilter?.trim() || n.typeInfo.listName !== nodo.typeInfo.listName) continue;
    const ast = arbolDe(n.choiceFilter);
    if (!ast) continue;
    const suyas = columnasDe(ast);
    if (propias.some((c) => suyas.has(c))) out.push(n.name);
  }
  return out;
}

function entradaDe(nombre: string, porNombre: ReadonlyMap<string, BuilderNode>, choices: XlsformEditorSheet): Entrada {
  const n = porNombre.get(nombre);
  const enumerable = !!n && esPreguntaDeSeleccion(n);
  const lista = enumerable ? n!.typeInfo.listName : "";
  return {
    nombre,
    etiqueta: n ? tituloDePregunta(n, porNombre) : nombre,
    fila: n?.rowIndex ?? null,
    multiple: n?.typeInfo.base === "select_multiple",
    lista,
    respuestas: enumerable ? opcionesDe(choices, lista, (x) => porNombre.get(x)?.label).map((o) => ({ codigo: o.codigo, etiqueta: o.etiqueta })) : null,
  };
}

/** Analiza el filtro de una pregunta. null si la fila no tiene choice_filter. */
export function analizarFiltro({ structure, choices }: EntradaModelo, fila: number): AnalisisFiltro | null {
  const nodo = structure?.byRow.get(fila);
  const expresion = nodo?.choiceFilter?.trim() ?? "";
  if (!structure || !nodo || !expresion) return null;
  const porNombre = mapaPorNombre(structure);
  const lista = nodo.typeInfo.listName?.trim() ?? "";
  const rota = esRellenoDeFilaRota(nodo, expresion);
  const forma = tipoDe(expresion, rota);
  const opciones = opcionesDe(choices, lista, (x) => porNombre.get(x)?.label);
  const ast = rota ? null : arbolDe(expresion);
  const columnas = ast ? [...columnasDe(ast)].filter((c) => c !== "name") : [];
  const nombresEntrada = ast ? [...refsDe(ast)] : [];
  const entradas = nombresEntrada.map((n) => entradaDe(n, porNombre, choices));
  const porEntrada = new Map(entradas.map((e) => [e.nombre, e]));
  const evaluable = !!ast && soportada(ast) && opciones.length > 0;

  const diagnosticos: Diagnostico[] = [];
  if (rota) diagnosticos.push({ clase: "rota" });
  for (const c of columnas) {
    if (!COLUMNAS_SIEMPRE.has(c) && !choices.columns.includes(c)) diagnosticos.push({ clase: "conflicto", columna: c, sugerida: columnaParecida(c, choices.columns) });
  }
  const conflicto = diagnosticos.length > 0;

  if (ast && evaluable && !conflicto) {
    // En un filtro fijo, las opciones sin marcar son el propósito: no se avisan.
    const nunca = forma.tipo === "fijo" ? [] : opciones.filter((o) => alcanzable(ast, choices, o, porEntrada) === false).map((o) => o.codigo);
    if (nunca.length) {
      let arreglo: { columna: string; cambios: { de: string; a: string }[] } | null = null;
      const c = forma.cascada;
      if (c && c.forma !== "incluye") {
        const iC = choices.columns.indexOf(c.columna);
        const madre = porEntrada.get(c.madre);
        const codigosMadre = new Set(madre?.respuestas?.map((r) => r.codigo) ?? []);
        const huerfanos = [...new Set(nunca.flatMap((cod) => opciones.find((o) => o.codigo === cod)!.filas.map((f) => (choices.rows[f]?.[iC] ?? "").trim())))];
        const conValor = huerfanos.filter((v) => v && !codigosMadre.has(v));
        // Sólo si TODAS las opciones ocultas tienen un código huérfano con arreglo seguro.
        if (conValor.length === huerfanos.length) {
          const cambios = arregloDeCodigos(conValor, madre);
          if (cambios) arreglo = { columna: c.columna, cambios };
        }
      }
      diagnosticos.push({ clase: "nunca", opciones: nunca, arreglo });
    }
    // Lista vacía: una sola pregunta de la que depende y sin una condición que apague el filtro entero a propósito
    // («… cuando País es Perú»: fuera de Perú la lista vacía es el diseño, no un defecto).
    const compuertas = ast.kind === "logical" && ast.op === "and" && ast.operands.some((o) => !tieneCampo(o));
    if (forma.tipo !== "opcion" && !compuertas) {
      if (entradas.length === 0) {
        if (!opcionesVisibles({ expresion, opciones, evaluable }, choices, {})?.length) diagnosticos.push({ clase: "vacia", entrada: "", respuestas: [] });
      } else if (entradas.length === 1 && entradas[0]!.respuestas) {
        const e = entradas[0]!;
        const vacias = e.respuestas!.filter((r) => {
          const vis = opcionesVisibles({ expresion, opciones, evaluable }, choices, { [e.nombre]: e.multiple ? [r.codigo] : r.codigo });
          return vis !== null && vis.length === 0;
        }).map((r) => r.codigo);
        if (vacias.length) diagnosticos.push({ clase: "vacia", entrada: e.nombre, respuestas: vacias });
      }
    }
  }

  return {
    fila,
    pregunta: nodo.name,
    etiqueta: tituloDePregunta(nodo, porNombre),
    baseType: nodo.typeInfo.base,
    lista,
    expresion,
    ...forma,
    entradas,
    opciones,
    columnas,
    compartidaCon: quienesComparten(structure, nodo, columnas),
    evaluable: evaluable && !conflicto,
    diagnosticos,
    estado: estadoDe(diagnosticos, evaluable && !conflicto, opciones.length === 0),
  };
}

/** Todas las preguntas con filtro, en el orden del formulario. */
export function analizarTodos(m: EntradaModelo): AnalisisFiltro[] {
  const out: AnalisisFiltro[] = [];
  for (const n of m.structure?.outline ?? []) {
    if (!n.choiceFilter?.trim()) continue;
    const a = analizarFiltro(m, n.rowIndex);
    if (a) out.push(a);
  }
  return out;
}

/**
 * Respuestas iniciales de la vista previa: para cada pregunta, la primera respuesta con la que se ve alguna opción que
 * no es fija (así la vista previa enseña el filtro funcionando); si ninguna sirve, la primera.
 */
export function respuestasIniciales(a: AnalisisFiltro, choices: XlsformEditorSheet): Respuestas {
  // Todas arrancan respondidas con su primera respuesta: una pregunta sin responder casa con las celdas vacías.
  const out: Respuestas = {};
  const valorDe = (e: Entrada, r: Respuesta) => (e.multiple ? [r.codigo] : r.codigo);
  for (const e of a.entradas) out[e.nombre] = e.respuestas?.length ? valorDe(e, e.respuestas[0]!) : e.multiple ? [] : "";
  const fijas = a.cascada?.siempre ?? a.porOpcion?.siempre ?? [];
  for (const e of a.entradas) {
    if (!e.respuestas?.length) continue;
    const antes = new Set(opcionesVisibles(a, choices, out) ?? []);
    if (a.tipo !== "opcion" && [...antes].some((c) => !fijas.includes(c))) break;
    const buena = e.respuestas.find((r) => {
      const vis = opcionesVisibles(a, choices, { ...out, [e.nombre]: valorDe(e, r) });
      return !!vis && vis.some((c) => !fijas.includes(c) && !antes.has(c));
    });
    if (buena) { out[e.nombre] = valorDe(e, buena); if (a.tipo !== "opcion") break; }
  }
  return out;
}
