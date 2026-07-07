import type { FlatCondition } from "./conditionAdapter";
import type { LogicCatalog, LogicScope } from "./builderTypes";
import { defaultPredicate, type PredicateKind } from "./operators";

export function defaultLiteralForPredicate(
  baseType: string,
  predicate: PredicateKind,
  catalog?: LogicCatalog,
): string {
  if (predicate.kind === "selected" || predicate.kind === "not_selected") {
    return catalog?.items[0]?.name ?? "";
  }
  if ((baseType === "select_one" || baseType === "select_multiple") && catalog?.items[0]?.name) {
    return catalog.items[0].name;
  }
  if (baseType === "integer" || baseType === "decimal") return "0";
  if (baseType === "date") return "2026-01-01";
  if (baseType === "datetime") return "2026-01-01T00:00";
  if (baseType === "time") return "00:00";
  return "valor";
}

export function valueForPredicateTransition(
  next: PredicateKind,
  currentValue: FlatCondition["value"],
  baseType: string,
  catalog?: LogicCatalog,
): FlatCondition["value"] {
  if (next.kind === "presence") return { kind: "literal", raw: "" };
  if (currentValue.kind === "ref") return currentValue;
  if (currentValue.raw.trim()) return currentValue;
  return {
    kind: "literal",
    raw: defaultLiteralForPredicate(baseType, next, catalog),
  };
}

export function buildDefaultCondition(scope: LogicScope): FlatCondition {
  const firstVar = scope.variables[0];
  const baseType = firstVar?.baseType ?? "text";
  const predicate = defaultPredicate(baseType);
  const catalog = firstVar?.listName ? scope.catalogsByListName.get(firstVar.listName) : undefined;

  return {
    variableName: firstVar?.name ?? "",
    predicate,
    value: {
      kind: "literal",
      raw: firstVar ? defaultLiteralForPredicate(baseType, predicate, catalog) : "",
    },
  };
}
