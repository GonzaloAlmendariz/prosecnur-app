import { describe, expect, test } from "vitest";
import { buildDefaultCondition, expandCondition, serializeExpression, type LogicScope } from ".";

function scope(partial: Partial<LogicScope>): LogicScope {
  return {
    variables: [],
    catalogsByListName: new Map(),
    ...partial,
  };
}

describe("buildDefaultCondition", () => {
  test("starts numeric rules with an editable equality value, not an empty-presence rule", () => {
    const condition = buildDefaultCondition(
      scope({
        variables: [
          {
            name: "edad",
            label: "Edad",
            baseType: "integer",
            rowIndex: 1,
          },
        ],
      }),
    );

    expect(condition.predicate).toMatchObject({ kind: "compare", op: "=" });
    expect(condition.value).toEqual({ kind: "literal", raw: "0" });
    expect(serializeExpression(expandCondition(condition))).toBe("${edad} = 0");
  });

  test("uses the first catalog option for guided selection rules", () => {
    const condition = buildDefaultCondition(
      scope({
        variables: [
          {
            name: "color",
            label: "Color",
            baseType: "select_multiple",
            listName: "colores",
            rowIndex: 2,
          },
        ],
        catalogsByListName: new Map([
          [
            "colores",
            {
              listName: "colores",
              items: [{ name: "rojo", label: "Rojo", rowIndex: 1 }],
            },
          ],
        ]),
      }),
    );

    expect(condition.predicate).toMatchObject({ kind: "selected" });
    expect(condition.value).toEqual({ kind: "literal", raw: "rojo" });
    expect(serializeExpression(expandCondition(condition))).toBe("selected(${color}, 'rojo')");
  });
});
