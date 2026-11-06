// Opciones que van solas en una pregunta de selección múltiple (checklist editor-conjoint, E18, 2026-11-06). Pedido de
// Gonzalo: «la clásica de que si marca esta o marca la otra ya no puede marcar más en select multiple». La regla XLSForm
// es `not((selected(., 'a') or selected(., 'b')) and count-selected(.) > 1)`; aquí se lee, se escribe y se combina con
// lo que la restricción ya tuviera, sin que nadie escriba la fórmula.

import type { Expr } from "../../logic";
import { parseExpression, serializeExpression } from "../../logic";

const esSeleccionActual = (e: Expr): e is Extract<Expr, { kind: "call" }> =>
  e.kind === "call" && e.name === "selected" && e.args.length === 2 && e.args[0]?.kind === "current" && e.args[1]?.kind === "literal";

const esVariasMarcadas = (e: Expr) =>
  e.kind === "compare" &&
  e.left.kind === "call" && e.left.name === "count-selected" && e.left.args[0]?.kind === "current" &&
  e.right.kind === "literal" &&
  ((e.op === ">" && Number(e.right.value) === 1) || (e.op === ">=" && Number(e.right.value) === 2));

function codigosSeleccionados(e: Expr): string[] | null {
  if (esSeleccionActual(e)) return [String((e.args[1] as Extract<Expr, { kind: "literal" }>).value)];
  if (e.kind === "logical" && e.op === "or") {
    const partes = e.operands.map(codigosSeleccionados);
    return partes.every(Boolean) ? (partes as string[][]).flat() : null;
  }
  return null;
}

/** Códigos de la regla «van solas» si `e` lo es; null si no. */
function solasDe(e: Expr): string[] | null {
  if (e.kind !== "not" || e.operand.kind !== "logical" || e.operand.op !== "and" || e.operand.operands.length !== 2) return null;
  const [a, b] = e.operand.operands as [Expr, Expr];
  const cuenta = esVariasMarcadas(a) ? a : esVariasMarcadas(b) ? b : null;
  if (!cuenta) return null;
  return codigosSeleccionados(cuenta === a ? b : a);
}

/** Separa la restricción en las opciones que van solas y el resto de la regla (texto ODK de las demás partes). */
export function leerSolas(constraint: string): { solas: string[]; resto: string[] } {
  const raw = constraint.trim();
  if (!raw) return { solas: [], resto: [] };
  const ast = parseExpression(raw);
  if (!ast || ast.kind === "raw") return { solas: [], resto: [raw] };
  const partes = ast.kind === "logical" && ast.op === "and" ? ast.operands : [ast];
  const solas: string[] = [];
  const otras: Expr[] = [];
  for (const p of partes) {
    const s = solasDe(p);
    if (s) solas.push(...s);
    else otras.push(p);
  }
  // El resto se conserva tal como estaba escrito cuando no hubo regla de solas que separar.
  if (!solas.length) return { solas: [], resto: [raw] };
  return { solas, resto: otras.map((o) => serializeExpression(o)) };
}

const lit = (c: string) => (c.includes("'") ? `"${c}"` : `'${c}'`);

/** La regla «van solas» para estos códigos (vacía si no hay ninguno). */
export function reglaSolas(codigos: readonly string[]): string {
  if (!codigos.length) return "";
  const sel = codigos.map((c) => `selected(., ${lit(c)})`);
  const cualquiera = sel.length === 1 ? sel[0]! : `(${sel.join(" or ")})`;
  return `not(${cualquiera} and count-selected(.) > 1)`;
}

/** La restricción con estas opciones como «van solas», conservando lo demás que ya exigía. */
export function escribirSolas(constraint: string, codigos: readonly string[]): string {
  const { resto } = leerSolas(constraint);
  const otras = resto.map((r) => r.trim()).filter(Boolean);
  const nueva = reglaSolas(codigos);
  // Una parte con «or» va entre paréntesis para que el «and» no le cambie el sentido.
  const partes = [...otras.map((o) => (otras.length + (nueva ? 1 : 0) > 1 && /\sor\s/.test(o) && !/^\(.*\)$/.test(o) ? `(${o})` : o)), ...(nueva ? [nueva] : [])];
  return partes.join(" and ");
}

const SUELE_IR_SOLA = /\b(ningun[oa]?|nada|no sab[ea]|no s[eé]|no respond[ea]|no responde|no precisa|no aplica|prefiere no|ninguna de las anteriores|no recuerda)\b/i;

/** Opciones cuya etiqueta suele ir sola («Ninguno», «No sabe», «No responde», «No aplica»…). */
export function sugeridasSolas(opciones: readonly { name: string; label: string }[]): string[] {
  return opciones.filter((o) => SUELE_IR_SOLA.test(o.label.normalize("NFC"))).map((o) => o.name);
}

/** Mensaje para quien marca una opción sola junto con otras. */
export function mensajeSolas(etiquetas: readonly string[]): string {
  if (!etiquetas.length) return "";
  if (etiquetas.length === 1) return `«${etiquetas[0]}» no se puede marcar junto con otras opciones.`;
  const lista = `${etiquetas.slice(0, -1).map((e) => `«${e}»`).join(", ")} y «${etiquetas[etiquetas.length - 1]}»`;
  return `${lista} no se pueden marcar junto con otras opciones.`;
}
