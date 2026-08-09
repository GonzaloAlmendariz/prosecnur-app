import { describe, expect, test } from "vitest";
import type { GraficadorMetadata } from "../../api/client";
import {
  chartDataPreflightIssue,
  hasConfiguredChartDataArgs,
  resolveGraficadorContract,
} from "./slidePreviewModel";

function metadata(
  patch: Partial<GraficadorMetadata> = {},
): GraficadorMetadata {
  return {
    name: "p_contract",
    titulo_humano: "Contrato",
    descripcion: "",
    icono_ui: "BarChart",
    args: [],
    args_extra: [],
    ...patch,
  };
}

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

  test("valida vars nombradas sin aceptar una lista anónima", () => {
    expect(hasConfiguredChartDataArgs({ vars: { Salud: ["a$p1", "b$p1"] } }, "named_vars")).toBe(true);
    expect(hasConfiguredChartDataArgs({ vars: ["a$p1", "b$p1"] }, "named_vars")).toBe(false);
  });

  test("capability no exige var y unknown falla cerrado", () => {
    expect(hasConfiguredChartDataArgs({}, "capability")).toBe(true);
    expect(hasConfiguredChartDataArgs({ var: "a$p1" }, "unknown")).toBe(false);
  });
});

describe("contrato machine-readable del preview", () => {
  test.each([
    ["dimensiones", { requisito: "dimensiones" }, "dimensions"],
    ["territorio", { feature_kind: "territorial_coverage" }, "territorial_coverage"],
  ] as const)("infiere %s para backends legacy", (_label, patch, capabilityKey) => {
    expect(resolveGraficadorContract(metadata(patch))).toMatchObject({
      capabilityKey,
      authoringMode: "direct",
      dataRequirement: "capability",
    });
    expect(chartDataPreflightIssue({}, metadata(patch))).toBeNull();
  });

  test("direct/named_vars conserva la recuperación en Datos sin inventar variable principal", () => {
    const graf = metadata({
      authoring_mode: "direct",
      data_requirement: "named_vars",
    });
    expect(chartDataPreflightIssue({ vars: { Tema: ["a$p1"] } }, graf)).toBeNull();
    expect(chartDataPreflightIssue({ vars: [] }, graf)).toMatch(/grupos de variables con nombre/);
    expect(chartDataPreflightIssue({ vars: [] }, graf)).toMatch(/pestaña Datos/);
    expect(chartDataPreflightIssue({ vars: [] }, graf)).not.toMatch(/variable principal/);
  });

  test("generated/named_vars exige un plan completo sin prometer recuperación en la biblioteca", () => {
    const graf = metadata({
      capability_key: "equivalences_exactly_two",
      authoring_mode: "generated",
      data_requirement: "named_vars",
    });

    expect(chartDataPreflightIssue({ vars: { Tema: ["a$p1", "b$p1"] } }, graf)).toBeNull();
    const issue = chartDataPreflightIssue({}, graf);
    expect(issue).toMatch(/plan.*equivalencias nombradas/i);
    expect(issue).toMatch(/biblioteca.*no puede completarlas/i);
    expect(issue).not.toMatch(/Datos|variable principal/i);
  });

  test("acepta capability generada en preflight y bloquea contratos desconocidos", () => {
    expect(chartDataPreflightIssue({}, metadata({
      capability_key: "equivalences_exactly_two",
      authoring_mode: "generated",
      data_requirement: "capability",
    }))).toBeNull();
    expect(chartDataPreflightIssue({ var: "a$p1" }, metadata({
      capability_key: "unknown",
      requirement_label: "Capacidad futura",
    }))).toBe("Capacidad futura");
  });
});
