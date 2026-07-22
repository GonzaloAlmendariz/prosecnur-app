import { describe, expect, test } from "vitest";
import { hasConfiguredChartDataArgs } from "./slidePreviewModel";

describe("hasConfiguredChartDataArgs", () => {
  test.each([
    ["variable principal", { var: "estudiantes$p1" }],
    ["lista de variables", { vars: ["estudiantes$p1", "estudiantes$p2"] }],
    [
      "variables nombradas por tema y fuente",
      {
        vars: {
          satisfaccion: ["estudiantes$p1", "egresados$p1"],
          conocimiento: ["docentes$p2", "administrativos$p2"],
        },
      },
    ],
    [
      "multiapiladas con bloques configurados",
      {
        modo: "multilista",
        bloques: [
          { modo: "var", vars: ["estudiantes$p1", "egresados$p1"] },
          {
            modo: "var_cruce",
            vars: { conocimiento: ["docentes$p2", "administrativos$p2"] },
          },
        ],
      },
    ],
  ])("acepta %s sin exigir args.var", (_caseName, args) => {
    expect(hasConfiguredChartDataArgs(args)).toBe(true);
  });

  test.each([
    ["argumentos vacios", {}],
    ["variable vacia", { var: "" }],
    ["lista vacia", { vars: [] }],
    ["mapa vacio", { vars: {} }],
    ["tema sin variables", { vars: { satisfaccion: [] } }],
    ["multilista sin bloques", { modo: "multilista", bloques: [] }],
    [
      "multilista con bloques vacios",
      { modo: "multilista", bloques: [{ modo: "var", vars: [] }] },
    ],
  ])("rechaza %s", (_caseName, args) => {
    expect(hasConfiguredChartDataArgs(args)).toBe(false);
  });
});
