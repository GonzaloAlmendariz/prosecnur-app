// Lectura humana de expresiones XLSForm («Se lee»), presets de validación y desglose de reglas.
// Extraído de canvas/FocusedWorkspace.tsx (refactor puro, revamp 2026-10-16) para que el
// Constructor y las pestañas Lógica, Restricciones y Cálculos lean las reglas con la misma voz.

import type { BuilderNode } from "../types";
import { parseExpression, serializeExpression, tryFlattenConstraint, type Expr, type LogicScope } from "../logic";
import { stripMarkdown } from "../helpers/markdown";

export type HumanizedExpression = {
  summary: string;
  raw: string;
  technical: boolean;
};

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
      return item ? ruleItemSentence(item) : describeExpr(operand, scope);
    });
    return [{
      subject: "Cualquiera de estas condiciones",
      relation: "puede cumplirse",
      values: options,
    }];
  }

  return [{
    subject: "Regla técnica importada",
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

export function describeExpression(
  expression: string,
  scope: LogicScope,
  options: { currentLabel?: string } = {},
): HumanizedExpression {
  const raw = expression.trim();
  if (!raw) {
    return { summary: "Sin condición", raw, technical: false };
  }

  const ast = parseExpression(raw);
  if (!ast) {
    return { summary: "Regla vacía", raw, technical: false };
  }

  const summary = describeExpr(ast, scope, options);
  return {
    summary,
    raw: exprRaw(ast, raw),
    technical: summary === "Regla técnica importada",
  };
}

export function describeValidation(
  expression: string,
  node: BuilderNode,
  scope: LogicScope,
): (HumanizedExpression & { status: string }) | null {
  const raw = expression.trim();
  if (!raw) return null;
  const ast = parseExpression(raw);
  if (!ast) {
    return {
      summary: "Validación técnica importada",
      raw,
      technical: true,
      status: "Regla técnica preservada",
    };
  }

  const known = knownValidation(ast, raw, node.typeInfo.base);
  if (known) {
    return {
      summary: known,
      raw: exprRaw(ast, raw),
      technical: false,
      status: "Preset claro",
    };
  }

  const editable = isConstraintVisuallyEditable(ast);
  const described = describeExpression(raw, scope, { currentLabel: "La respuesta" });
  return {
    ...described,
    technical: !editable || described.technical,
    status: editable ? "Editable visualmente" : "Regla técnica preservada",
  };
}

export function describeExpr(
  expr: Expr,
  scope: LogicScope,
  options: { currentLabel?: string } = {},
): string {
  if (expr.kind === "logical") {
    const connector = expr.op === "and" ? " y " : " o ";
    return expr.operands
      .map((operand) => describeExpr(operand, scope, options))
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
    return `No se cumple: ${describeExpr(expr.operand, scope, options)}`;
  }

  if (expr.kind === "call" && expr.name === "today") return "hoy";
  if (expr.kind === "call" && expr.name === "now") return "ahora";
  if (expr.kind === "literal") return literalLabel(expr.value);
  if (expr.kind === "ref" || expr.kind === "current") return describeOperand(expr, scope, options);

  return "Regla técnica importada";
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

export function knownValidation(expr: Expr, raw: string, baseType: string): string | null {
  const normalized = raw.toLowerCase().replace(/\s+/g, "");
  if (expr.kind === "call" && expr.name === "regex" && expr.args[0]?.kind === "current") {
    const pattern = expr.args[1]?.kind === "literal" ? String(expr.args[1].value).toLowerCase() : normalized;
    if (pattern.includes("@")) return "La respuesta debe tener formato de correo electrónico.";
    if (pattern.includes("http")) return "La respuesta debe ser un enlace web válido.";
    if (pattern.includes("a-z") && pattern.includes("0-9") && pattern.includes("_-")) {
      return "La respuesta debe ser un código sin espacios.";
    }
    if (pattern.includes("\\d") || pattern.includes("[0-9]")) return "La respuesta debe usar solo números.";
  }
  if (baseType === "date" && normalized.includes("<=today()")) {
    return "La fecha no puede ser posterior a hoy.";
  }
  if (normalized === ".>=0") return "La respuesta debe ser cero o mayor.";
  if (normalized === ".>0") return "La respuesta debe ser mayor que cero.";
  return null;
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
