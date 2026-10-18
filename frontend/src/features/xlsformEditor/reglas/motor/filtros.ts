// Voz de FILTRO DE OPCIONES (choice_filter): qué opciones de la lista se muestran. Los nombres sueltos son columnas
// de la hoja choices (el parser de lectura los entrega como `call "@campo"`).
//   Bureau = ${Bureau}                    → Muestra las opciones cuya columna Bureau coincide con la respuesta de ‹Bureau›
//   selected(${gasto}, filter_Spent)      → Muestra las opciones cuya columna filter_Spent está marcada en ‹Gasto›
//   selected(filter_Q, ${Q})              → Muestra las opciones cuya columna filter_Q incluye la respuesta de ‹Q›
//   REF02CO = 'kk'                        → Muestra siempre las mismas opciones: las marcadas con kk en la columna REF02CO
//   ${pais} = 'PER' and (name = '1' or …) → Muestra solo las opciones ‹A›, ‹B› … cuando ‹País› es ‹Perú›

import type { Expr } from "../../logic";
import { opcion, pregunta, type Contexto } from "./contexto";
import { capitalizar, enumerar, t, v, type Frase } from "./frase";
import { leerCondicion } from "./condicion";
import { literalLegible } from "./valores";

type Clausula =
  | { tipo: "coincide"; columnas: string[]; ref: string; negada: boolean }
  | { tipo: "marcada"; columna: string; ref: string }
  // La columna de la opción lista varios valores separados por espacio (forma compacta del filtro por opción).
  | { tipo: "incluye"; columna: string; ref: string }
  | { tipo: "igual"; columna: string; valor: string; negada: boolean }
  | { tipo: "opciones"; valores: string[] };

const campo = (e: Expr | undefined): string | null =>
  e?.kind === "call" && e.name === "@campo" && e.args[0]?.kind === "literal" ? String(e.args[0].value) : null;

function tieneCampo(e: Expr): boolean {
  if (campo(e) !== null) return true;
  if (e.kind === "compare") return tieneCampo(e.left) || tieneCampo(e.right);
  if (e.kind === "logical") return e.operands.some(tieneCampo);
  if (e.kind === "not") return tieneCampo(e.operand);
  if (e.kind === "call") return e.args.some(tieneCampo);
  return false;
}

function clausula(e: Expr): Clausula | null {
  if (e.kind === "compare" && (e.op === "=" || e.op === "!=")) {
    const [col, otro] = campo(e.left) !== null ? [campo(e.left)!, e.right] : campo(e.right) !== null ? [campo(e.right)!, e.left] : [null, null];
    if (col === null || !otro) return null;
    if (otro.kind === "ref") return { tipo: "coincide", columnas: [col], ref: otro.name, negada: e.op === "!=" };
    if (otro.kind === "literal") {
      if (col === "name" && e.op === "=") return { tipo: "opciones", valores: [String(otro.value)] };
      return { tipo: "igual", columna: col, valor: String(otro.value), negada: e.op === "!=" };
    }
    return null;
  }
  if (e.kind === "call" && e.name === "selected" && e.args.length === 2) {
    const col = campo(e.args[1]);
    const q = e.args[0];
    if (col !== null && q?.kind === "ref") return { tipo: "marcada", columna: col, ref: q.name };
    const colLista = campo(e.args[0]);
    const r = e.args[1];
    if (colLista !== null && r?.kind === "ref") return { tipo: "incluye", columna: colLista, ref: r.name };
  }
  return null;
}

/** Junta cláusulas que dicen lo mismo con distintos valores (opciones sueltas; columnas contra la misma pregunta). */
function agrupar(cs: Clausula[]): Clausula[] {
  const out: Clausula[] = [];
  for (const c of cs) {
    const prev = out[out.length - 1];
    if (prev?.tipo === "opciones" && c.tipo === "opciones") prev.valores.push(...c.valores);
    else if (prev?.tipo === "coincide" && c.tipo === "coincide" && prev.ref === c.ref && prev.negada === c.negada) prev.columnas.push(...c.columnas);
    else out.push(c.tipo === "opciones" ? { tipo: "opciones", valores: [...c.valores] } : c.tipo === "coincide" ? { ...c, columnas: [...c.columnas] } : c);
  }
  return out;
}

function columna(nombre: string): Frase {
  return nombre === "name" ? [t("cuyo código")] : [t("cuya columna"), v(nombre)];
}

function frasear(c: Clausula, ctx: Contexto, lista: string, sola: boolean): Frase {
  switch (c.tipo) {
    case "coincide": {
      const cols = c.columnas.length === 1 ? columna(c.columnas[0]!) : [t("cuya columna"), ...enumerar(c.columnas.map((x) => [v(x)]), "o")];
      return [...cols, t(c.negada ? "no coincide con" : "coincide con"), ...(sola ? [t("la respuesta de")] : []), pregunta(c.ref, ctx)];
    }
    case "marcada":
      return [...columna(c.columna), t("está marcada en"), pregunta(c.ref, ctx)];
    case "incluye":
      return [...columna(c.columna), t("incluye"), ...(sola ? [t("la respuesta de")] : []), pregunta(c.ref, ctx)];
    case "igual":
      return [t("con"), v(c.columna), t(c.negada ? "distinto de" : "igual a"), v(literalLegible(c.valor))];
    case "opciones": {
      const piezas = c.valores.map((val) => [opcion(lista, val, ctx) ?? v(val)]);
      return [t(c.valores.length === 1 ? "la opción" : "las opciones"), ...enumerar(piezas, sola ? "y" : "o")];
    }
  }
}

/** Cláusulas de un nivel (or / and / una sola), o null si alguna no se reconoce. */
function clausulas(e: Expr, op: "and" | "or"): Clausula[] | null {
  const ops = e.kind === "logical" && e.op === op ? e.operands : [e];
  const cs = ops.map((o) => (o.kind === "logical" && o.op === "or" && op === "or" ? clausulas(o, "or") : [clausula(o)]));
  if (cs.some((x) => !x || x.some((c) => !c))) return null;
  return agrupar((cs as Clausula[][]).flat());
}

/** `fijo`: el filtro no mira ninguna respuesta, así que muestra siempre el mismo subconjunto de la lista. */
function leerOpciones(e: Expr, ctx: Contexto, lista: string, fijo: boolean): Frase | null {
  const cs = clausulas(e, e.kind === "logical" && e.op === "and" ? "and" : "or");
  if (!cs || !cs.length) return null;
  const y = e.kind === "logical" && e.op === "and";
  if (cs.length === 1) {
    const c = cs[0]!;
    if (c.tipo === "opciones") return [t(fijo ? "muestra siempre solo" : "muestra solo"), ...frasear(c, ctx, lista, true)];
    if (c.tipo === "igual" && fijo) {
      return [t(c.negada ? "muestra siempre las mismas opciones: las que no tienen" : "muestra siempre las mismas opciones: las marcadas con"), v(literalLegible(c.valor)), t("en la columna"), v(c.columna)];
    }
    if (c.tipo === "igual") return [t("muestra solo las opciones"), ...frasear(c, ctx, lista, true)];
    return [t("muestra las opciones"), ...frasear(c, ctx, lista, true)];
  }
  const partes = cs.map((c) => frasear(c, ctx, lista, false));
  return [t("muestra las opciones"), ...enumerar(partes, y ? "y" : "o")];
}

export function leerFiltro(e: Expr, ctx: Contexto, lista: string): Frase | null {
  // Partes con columna (qué opciones) y partes sin columna (cuándo): «… cuando ‹País› es ‹Perú›».
  const operandos = e.kind === "logical" && e.op === "and" ? e.operands : [e];
  const conCampo = operandos.filter(tieneCampo);
  const sinCampo = operandos.filter((o) => !tieneCampo(o));
  if (!conCampo.length) return null;
  const opciones = leerOpciones(conCampo.length === 1 ? conCampo[0]! : { kind: "logical", op: "and", operands: conCampo }, ctx, lista, !sinCampo.length);
  if (!opciones) return null;
  if (!sinCampo.length) return capitalizar(opciones);
  const cuando = leerCondicion(sinCampo.length === 1 ? sinCampo[0]! : { kind: "logical", op: "and", operands: sinCampo }, ctx);
  return cuando ? capitalizar([...opciones, t("cuando"), ...cuando]) : null;
}
