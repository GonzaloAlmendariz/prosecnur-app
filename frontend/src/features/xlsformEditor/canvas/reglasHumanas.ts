// Lectura humana de expresiones XLSForm («Se lee»), presets de validación y desglose de reglas.
// Extraído de canvas/FocusedWorkspace.tsx (refactor puro, revamp 2026-10-16) para que el
// Constructor y las pestañas Lógica, Restricciones y Cálculos lean las reglas con la misma voz.

import type { BuilderNode } from "../types";
import { parseExpression, parseExpressionLectura, serializeExpression, tryFlattenConstraint, type Expr, type LogicScope } from "../logic";
import { stripMarkdown } from "../helpers/markdown";
import { describeCall, describeRaw } from "./reglasFunciones";
import { leerRegla } from "../reglas/leerRegla";
import { leerConContexto, separarAviso } from "../reglas/motor";
import { tocaActual } from "../reglas/motor/contexto";
import { textoDePiezas, type ColumnaRegla, type LecturaRegla } from "../reglas/piezas";

const TECNICA = "Regla técnica importada";

export type HumanizedExpression = {
  /** La frase, sin avisos. */
  summary: string;
  raw: string;
  technical: boolean;
  /** Aviso aparte de la frase (comillas tipográficas). */
  aviso?: string;
};

/** ¿La expresión nombra columnas sueltas de la hoja choices? Sólo un choice_filter lo hace (`REF02CO = 'kk'`). */
function nombraColumnas(e: Expr): boolean {
  if (e.kind === "call") return e.name === "@campo" || e.args.some(nombraColumnas);
  if (e.kind === "compare") return nombraColumnas(e.left) || nombraColumnas(e.right);
  if (e.kind === "logical") return e.operands.some(nombraColumnas);
  if (e.kind === "not") return nombraColumnas(e.operand);
  return false;
}

/**
 * Columna con que se lee una expresión sin pregunta dueña: una que nombra columnas de choices es un filtro de opciones,
 * una que mira «.» es una restricción y el resto, un valor o una condición. Así Lógica y el Constructor leen el filtro
 * igual que la pestaña Filtros, en vez de llamarlo «Regla técnica importada».
 */
export function columnaDeExpresion(raw: string): ColumnaRegla {
  const ast = parseExpressionLectura(raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"));
  if (!ast || ast.kind === "raw") return "calculation";
  if (nombraColumnas(ast)) return "choice_filter";
  return tocaActual(ast) ? "constraint" : "calculation";
}

/** Una lectura del motor como frase plana con su aviso aparte. */
export function fraseDeLectura(lectura: LecturaRegla, tecnica = TECNICA): { texto: string; aviso?: string } {
  if (lectura.tecnica) return { texto: tecnica };
  const { piezas, aviso } = separarAviso(lectura.piezas);
  return aviso ? { texto: textoDePiezas(piezas), aviso } : { texto: textoDePiezas(piezas) };
}

export type RuleBreakdown = {
  title: string;
  raw: string;
  technical: boolean;
  items: RuleBreakdownItem[];
};

export type RuleBreakdownItem = {
  subject: string;
  relation: string;
  value?: string;
  values?: string[];
};

export type ValidationPreset = {
  id: string;
  label: string;
  hint: string;
  expression: string;
  message: string;
};

export function describeRuleBreakdown(expression: string, scope: LogicScope, targetLabel: string): RuleBreakdown {
  const raw = expression.trim();
  const ast = parseExpression(raw);
  if (!raw || !ast) {
    return {
      title: "Sin condición legible",
      raw,
      technical: !ast && Boolean(raw),
      items: [{ subject: raw || "Sin condición", relation: "" }],
    };
  }

  const items = ruleItemsFromExpr(ast, scope);
  const title = items.length === 1
    ? `${targetLabel} aparece con esta regla`
    : `${targetLabel} aparece cuando se cumplen ${items.length} reglas`;
  return {
    title,
    raw: exprRaw(ast, raw),
    technical: items.some((item) => item.subject === "Regla técnica importada"),
    items,
  };
}

export function ruleItemsFromExpr(expr: Expr, scope: LogicScope): RuleBreakdownItem[] {
  if (expr.kind === "logical" && expr.op === "and") {
    return expr.operands.flatMap((operand) => ruleItemsFromExpr(operand, scope));
  }

  const multiSelected = multiSelectedRuleItem(expr, scope);
  if (multiSelected) return [multiSelected];

  const simple = simpleRuleItem(expr, scope);
  if (simple) return [simple];

  if (expr.kind === "logical" && expr.op === "or") {
    const options = expr.operands.map((operand) => {
      const item = simpleRuleItem(operand, scope) ?? multiSelectedRuleItem(operand, scope);
      if (item) return ruleItemSentence(item);
      const l = leerConContexto("relevant", exprRaw(operand, ""), { columna: "relevant", scope, actual: null });
      return l.tecnica ? describeExpr(operand, scope) : fraseDeLectura(l).texto;
    });
    return [{
      subject: "Cualquiera de estas condiciones",
      relation: "puede cumplirse",
      values: options,
    }];
  }

  // Lo que el desglose no parte en sujeto + relación lo lee el motor entero; sólo si tampoco sabe es técnica.
  const lectura = leerConContexto("relevant", exprRaw(expr, ""), { columna: "relevant", scope, actual: null });
  if (!lectura.tecnica) return [{ subject: fraseDeLectura(lectura).texto, relation: "" }];
  return [{
    subject: TECNICA,
    relation: describeExpr(expr, scope),
  }];
}

export function simpleRuleItem(expr: Expr, scope: LogicScope): RuleBreakdownItem | null {
  if (expr.kind === "compare") {
    const presence = presenceCompare(expr);
    if (presence) {
      return {
        subject: describeOperand(expr.left, scope),
        relation: presence === "answered" ? "tiene respuesta" : "está vacía",
      };
    }
    const variableName = expr.left.kind === "ref" ? expr.left.name : undefined;
    return {
      subject: describeOperand(expr.left, scope),
      relation: `${compareLabel(expr.op)} `,
      value: describeOperand(expr.right, scope, {}, variableName),
    };
  }

  const selected = selectedRuleParts(expr);
  if (selected) {
    const variable = scope.variables.find((candidate) => candidate.name === selected.variableName);
    const value = variable?.listName
      ? choiceLabel(variable.listName, selected.value, scope)
      : selected.value;
    return {
      subject: variableLabel(selected.variableName, scope),
      relation: selected.negated ? "no incluye " : "incluye ",
      value,
    };
  }

  return null;
}

export function multiSelectedRuleItem(expr: Expr, scope: LogicScope): RuleBreakdownItem | null {
  if (expr.kind !== "logical" || expr.op !== "or" || expr.operands.length < 2) return null;
  const parts = expr.operands.map(selectedRuleParts);
  if (parts.some((part) => !part || part.negated)) return null;
  const first = parts[0];
  if (!first) return null;
  if (parts.some((part) => part?.variableName !== first.variableName)) return null;
  const variable = scope.variables.find((candidate) => candidate.name === first.variableName);
  const values = parts.map((part) => {
    const raw = part?.value ?? "";
    return variable?.listName ? choiceLabel(variable.listName, raw, scope) : raw;
  });
  return {
    subject: variableLabel(first.variableName, scope),
    relation: "incluye cualquiera de estas opciones",
    values,
  };
}

export function selectedRuleParts(expr: Expr): { variableName: string; value: string; negated: boolean } | null {
  if (expr.kind === "call" && expr.name === "selected" && expr.args.length === 2) {
    const variable = expr.args[0];
    const value = expr.args[1];
    if (variable?.kind === "ref" && value?.kind === "literal") {
      return { variableName: variable.name, value: String(value.value), negated: false };
    }
  }
  if (
    expr.kind === "not" &&
    expr.operand.kind === "call" &&
    expr.operand.name === "selected" &&
    expr.operand.args.length === 2
  ) {
    const variable = expr.operand.args[0];
    const value = expr.operand.args[1];
    if (variable?.kind === "ref" && value?.kind === "literal") {
      return { variableName: variable.name, value: String(value.value), negated: true };
    }
  }
  return null;
}

export function ruleItemSentence(item: RuleBreakdownItem): string {
  if (item.values?.length) {
    return `${item.subject} ${item.relation}: ${item.values.join(", ")}`;
  }
  return `${item.subject} ${item.relation}${item.value ?? ""}`.trim();
}

/**
 * Lectura humana de una expresión sin pregunta dueña (condiciones, cálculos, ejemplos). El texto sale del motor de
 * reglas en piezas (`reglas/motor`), así todas las vistas leen con la misma voz que el panel de cada marca.
 */
export function describeExpression(
  expression: string,
  scope: LogicScope,
  _options: { currentLabel?: string } = {},
): HumanizedExpression {
  const raw = expression.trim();
  if (!raw) {
    return { summary: "Sin condición", raw, technical: false };
  }
  const ast = parseExpression(raw);
  // Una expresión sobre «.» es una restricción: se lee con la voz de lo que acepta; una con columnas sueltas, un filtro.
  const columna = columnaDeExpresion(raw);
  const lectura = leerConContexto(columna, raw, { columna, scope, actual: null });
  const { texto, aviso } = fraseDeLectura(lectura);
  return { summary: texto, raw: ast ? exprRaw(ast, raw) : raw, technical: lectura.tecnica, ...(aviso ? { aviso } : {}) };
}

/**
 * Lectura de una columna de una fila con el motor (`leerRegla`): la misma frase que el riel, la pestaña Filtros y
 * Restricciones. La usan Lógica y el Mapa para no armar su propia lectura.
 */
export function leerColumna(columna: ColumnaRegla, node: BuilderNode, raw: string, scope: LogicScope): HumanizedExpression {
  const expr = raw.trim();
  if (!expr) return { summary: "Sin condición", raw: expr, technical: false };
  const lectura = leerRegla(columna, expr, node, scope);
  const { texto, aviso } = fraseDeLectura(lectura);
  return { summary: texto, raw: expr, technical: lectura.tecnica, ...(aviso ? { aviso } : {}) };
}

export function describeValidation(
  expression: string,
  node: BuilderNode,
  scope: LogicScope,
): (HumanizedExpression & { status: string }) | null {
  const raw = expression.trim();
  if (!raw) return null;
  const ast = parseExpression(raw);
  const lectura = leerRegla("constraint", raw, node, scope);
  const { texto: summary, aviso } = fraseDeLectura(lectura, "Validación técnica importada");
  const extra = aviso ? { aviso } : {};
  if (!ast || ast.kind === "raw") {
    return { summary, raw, technical: true, status: "Regla técnica preservada", ...extra };
  }
  if (esPresetClaro(ast, node.typeInfo.base)) {
    return { summary, raw: exprRaw(ast, raw), technical: false, status: "Preset claro", ...extra };
  }
  const editable = isConstraintVisuallyEditable(ast);
  return {
    summary,
    raw: exprRaw(ast, raw),
    technical: !editable || lectura.tecnica,
    status: editable ? "Editable visualmente" : "Regla técnica preservada",
    ...extra,
  };
}

export function describeExpr(
  expr: Expr,
  scope: LogicScope,
  options: { currentLabel?: string } = {},
): string {
  if (expr.kind === "logical") {
    const rango = expr.op === "and" ? describeRange(expr.operands, scope, options) : null;
    if (rango) return rango;
    const connector = expr.op === "and" ? " y " : " o ";
    // Sólo la primera cláusula abre con mayúscula: «La respuesta es X y la respuesta no es Y».
    return expr.operands
      .map((operand, i) => {
        const frase = describeExpr(operand, scope, options);
        return i > 0 && /^La /.test(frase) ? `la ${frase.slice(3)}` : frase;
      })
      .join(connector);
  }

  if (expr.kind === "compare") {
    const presence = presenceCompare(expr);
    if (presence) {
      return `${describeOperand(expr.left, scope, options)} ${
        presence === "answered" ? "tiene respuesta" : "está vacía"
      }`;
    }
    const variableName = expr.left.kind === "ref" ? expr.left.name : undefined;
    return [
      describeOperand(expr.left, scope, options),
      compareLabel(expr.op),
      describeOperand(expr.right, scope, options, variableName),
    ].join(" ");
  }

  if (expr.kind === "call" && expr.name === "selected" && expr.args.length === 2) {
    const variable = expr.args[0];
    const value = expr.args[1];
    const variableName = variable.kind === "ref" ? variable.name : undefined;
    return `${describeOperand(variable, scope, options)} incluye ${describeOperand(value, scope, options, variableName)}`;
  }

  if (
    expr.kind === "not" &&
    expr.operand.kind === "call" &&
    expr.operand.name === "selected" &&
    expr.operand.args.length === 2
  ) {
    const variable = expr.operand.args[0]!;
    const value = expr.operand.args[1]!;
    const variableName = variable.kind === "ref" ? variable.name : undefined;
    return `${describeOperand(variable, scope, options)} no incluye ${describeOperand(value, scope, options, variableName)}`;
  }

  if (expr.kind === "not") {
    const exclusiva = opcionExclusiva(expr.operand, scope);
    if (exclusiva) return exclusiva;
    return `No puede pasar que ${describeExpr(expr.operand, scope, options).replace(/^La /, "la ")}`;
  }

  if (expr.kind === "call" && expr.name === "today") return "hoy";
  if (expr.kind === "call" && expr.name === "now") return "ahora";
  if (expr.kind === "literal") return literalLabel(expr.value);
  if (expr.kind === "ref" || expr.kind === "current") return describeOperand(expr, scope, options);

  const llamada = describeCall(expr, (e) => describeExpr(e, scope, options), scope);
  if (llamada && !llamada.includes(TECNICA)) return llamada;
  if (expr.kind === "raw") {
    const crudo = describeRaw(expr.text, scope);
    if (crudo) return crudo;
  }

  return TECNICA;
}

export function describeOperand(
  expr: Expr,
  scope: LogicScope,
  options: { currentLabel?: string } = {},
  valueForVariableName?: string,
): string {
  if (expr.kind === "current") return options.currentLabel ?? "La respuesta";
  if (expr.kind === "ref") return variableLabel(expr.name, scope);
  if (expr.kind === "literal") {
    const listName = valueForVariableName
      ? scope.variables.find((variable) => variable.name === valueForVariableName)?.listName
      : undefined;
    if (listName) return choiceLabel(listName, String(expr.value), scope);
    return literalLabel(expr.value);
  }
  if (expr.kind === "call" && expr.name === "today") return "hoy";
  if (expr.kind === "call" && expr.name === "now") return "ahora";
  return describeExpr(expr, scope, options);
}

export function variableLabel(name: string, scope: LogicScope): string {
  const variable = scope.variables.find((candidate) => candidate.name === name);
  return stripMarkdown(variable?.label || name);
}

export function choiceLabel(listName: string, rawValue: string, scope: LogicScope): string {
  const item = scope.catalogsByListName
    .get(listName)
    ?.items.find((choice) => choice.name === rawValue);
  return stripMarkdown(item?.label || rawValue);
}

export function literalLabel(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (value === "") return "vacío";
  return String(value);
}

export function presenceCompare(expr: Expr): "answered" | "empty" | null {
  if (expr.kind !== "compare") return null;
  if (expr.right.kind !== "literal" || expr.right.value !== "") return null;
  if (expr.left.kind !== "ref" && expr.left.kind !== "current") return null;
  if (expr.op === "!=") return "answered";
  if (expr.op === "=") return "empty";
  return null;
}

export function compareLabel(op: string): string {
  switch (op) {
    case "=":
      return "es";
    case "!=":
      return "no es";
    case "<":
      return "es menor que";
    case "<=":
      return "es menor o igual que";
    case ">":
      return "es mayor que";
    case ">=":
      return "es mayor o igual que";
    default:
      return op;
  }
}

export function exprRaw(expr: Expr, fallback: string): string {
  try {
    return serializeExpression(expr);
  } catch {
    return fallback;
  }
}

export function isConstraintVisuallyEditable(expr: Expr): boolean {
  if (tryFlattenConstraint(expr)) return true;
  if (expr.kind !== "logical") return false;
  return expr.operands.every((operand) => Boolean(tryFlattenConstraint(operand)));
}

/**
 * ¿La restricción es uno de los atajos que el editor muestra como aviso guiado («Preset claro») en lugar del
 * constructor? Sólo clasifica la forma para la UI; la frase la redacta siempre el motor.
 */
export function esPresetClaro(expr: Expr, baseType: string): boolean {
  if (expr.kind === "call" && expr.name === "regex" && expr.args[0]?.kind === "current" && expr.args[1]?.kind === "literal") return true;
  if (expr.kind !== "compare" || expr.left.kind !== "current") return false;
  if (baseType === "date" && expr.op === "<=" && expr.right.kind === "call" && expr.right.name === "today") return true;
  return (expr.op === ">=" || expr.op === ">") && expr.right.kind === "literal" && expr.right.value === 0;
}

export function validationPresetsFor(node: BuilderNode): ValidationPreset[] {
  switch (node.typeInfo.base) {
    // "text" ya no vive aquí: las reglas de texto (regex) las sirve la
    // galería humana TextRuleSuite en ValidationSummary — una sola fuente
    // (inspector/logic/textRules.ts) con parámetros y probador en vivo.
    case "integer":
    case "decimal":
      return [
        {
          id: "non-negative",
          label: "Cero o más",
          hint: "Acepta cero o valores mayores.",
          expression: ". >= 0",
          message: "Ingresa un valor igual o mayor que cero.",
        },
        {
          id: "positive",
          label: "Mayor que cero",
          hint: "Rechaza cero y valores negativos.",
          expression: ". > 0",
          message: "Ingresa un valor mayor que cero.",
        },
      ];
    case "date":
      // Una regla que ya compara con today() («. = today()», «. <= today()») no recibe el atajo: ofrecerlo
      // reemplazaría una regla más estricta por otra más laxa (S12).
      if (/\btoday\(\)/.test(node.constraint ?? "")) return [];
      return [
        {
          id: "not-future",
          label: "Fecha hasta hoy",
          hint: "La fecha debe ser hoy o anterior.",
          expression: ". <= today()",
          message: "La fecha no puede ser posterior a hoy.",
        },
      ];
    default:
      return [];
  }
}

/** «X >= a and X <= b» sobre el mismo sujeto se lee como un rango: «La respuesta está entre 18 y 100». */
function describeRange(operands: Expr[], scope: LogicScope, options: { currentLabel?: string }): string | null {
  if (operands.length !== 2) return null;
  const [a, b] = operands;
  if (a.kind !== "compare" || b.kind !== "compare") return null;
  const mismoSujeto = JSON.stringify(a.left) === JSON.stringify(b.left);
  if (!mismoSujeto) return null;
  const bajo = [a, b].find((c) => c.op === ">=" || c.op === ">");
  const alto = [a, b].find((c) => c.op === "<=" || c.op === "<");
  if (!bajo || !alto) return null;
  const sujeto = describeOperand(bajo.left, scope, options);
  const min = describeOperand(bajo.right, scope, options);
  const max = describeOperand(alto.right, scope, options);
  if (bajo.op === ">=" && alto.op === "<=") return min === max ? `${sujeto} es exactamente ${min}` : `${sujeto} está entre ${min} y ${max}`;
  return `${sujeto} es ${bajo.op === ">" ? "mayor que" : "al menos"} ${min} y ${alto.op === "<" ? "menor que" : "como máximo"} ${max}`;
}

/** not(selected(., 'x') and count-selected(.) > 1) — «“Ninguna” no se puede marcar junto con otras opciones». */
function opcionExclusiva(expr: Expr, scope: LogicScope): string | null {
  if (expr.kind !== "logical" || expr.op !== "and" || expr.operands.length !== 2) return null;
  const sel = expr.operands.find((o) => o.kind === "call" && o.name === "selected" && o.args.length === 2);
  const cuenta = expr.operands.find(
    (o) => o.kind === "compare" && o.op === ">" && o.left.kind === "call" && o.left.name === "count-selected" && o.right.kind === "literal" && o.right.value === 1,
  );
  if (!sel || !cuenta || sel.kind !== "call") return null;
  const valor = sel.args[1];
  const nombre = valor.kind === "literal" ? String(valor.value) : "esa opción";
  return `«${nombre}» no se puede marcar junto con otras opciones`;
}

/** Ortografía final de una lectura: mayúscula inicial y contracciones («de el» → «del»). */
export function pulir(frase: string): string {
  const t = frase
    .replace(/\b(Si|si|que|y|o|cuando) La respuesta\b/g, "$1 la respuesta")
    .replace(/\bde el\b/g, "del").replace(/\ba el\b/g, "al").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
