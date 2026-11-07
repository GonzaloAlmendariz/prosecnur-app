// E19 paso 2: «‹Q› tiene al menos N opciones marcadas» como condición del constructor. Mata: que la forma caiga a
// «avanzada», que el número se pierda en la vuelta y que un código de opción quede como número al cambiar de criterio.
import { describe, expect, test } from "vitest";
import { expandCondition, tryFlattenCondition } from "./conditionAdapter";
import { valueForPredicateTransition } from "./defaultCondition";
import { parseExpression, serializeExpression } from "./index";
import { predicatesForType } from "./operators";

describe("cuántas marcó como condición", () => {
  test("se aplana y vuelve igual", () => {
    for (const raw of ["count-selected(${medios}) >= 2", "count-selected(${medios}) <= 3", "count-selected(${medios}) = 1"]) {
      const flat = tryFlattenCondition(parseExpression(raw)!);
      expect(flat?.predicate.kind).toBe("count");
      expect(serializeExpression(expandCondition(flat!))).toBe(raw);
    }
  });
  test("select_multiple lo ofrece; select_one no", () => {
    expect(predicatesForType("select_multiple").some((p) => p.kind === "count")).toBe(true);
    expect(predicatesForType("select_one").some((p) => p.kind === "count")).toBe(false);
  });
  test("cambiar de criterio no arrastra un valor que ya no significa lo mismo", () => {
    const catalogo = { listName: "m", items: [{ name: "tv", label: "Televisión" }] } as never;
    const count = { kind: "count", op: ">=", label: "" } as const;
    const sel = { kind: "selected", label: "incluye" } as const;
    expect(valueForPredicateTransition(count, { kind: "literal", raw: "tv" }, "select_multiple", catalogo)).toEqual({ kind: "literal", raw: "1" });
    expect(valueForPredicateTransition(sel, { kind: "literal", raw: "2" }, "select_multiple", catalogo)).toEqual({ kind: "literal", raw: "tv" });
  });
  test("«incluye» escribe el código de la opción como texto", () => {
    const flat = tryFlattenCondition(parseExpression("selected(${medios}, '1')")!)!;
    expect(serializeExpression(expandCondition(flat))).toBe("selected(${medios}, '1')");
    const sinComillas = tryFlattenCondition(parseExpression("not(selected(${medios}, 1))")!)!;
    expect(serializeExpression(expandCondition(sinComillas))).toBe("not(selected(${medios}, '1'))");
  });
  test("una fecha frente a hoy se aplana y vuelve igual", () => {
    for (const raw of ["${nac} < today()", "${visita} >= today()"]) {
      const flat = tryFlattenCondition(parseExpression(raw)!)!;
      expect(flat.value).toEqual({ kind: "literal", raw: "today()" });
      expect(serializeExpression(expandCondition(flat))).toBe(raw);
    }
  });
});
