import { describe, expect, test } from "vitest";
import { basesSinCubrir, coberturaPorBase } from "../coberturaPorBase";
import type { GraficosCoverageSource } from "../../../api/client";

const fuente = (
  name: string,
  vars: Array<{ name: string; countable: boolean; status: string }>,
): GraficosCoverageSource => ({
  name,
  variables: vars.map((v) => ({
    name: v.name,
    label: v.name,
    tipo: "select_one",
    coverage_countable: v.countable,
    status: v.status,
  })) as GraficosCoverageSource["variables"],
});

describe("cobertura por base", () => {
  const sources = [
    fuente("docentes", [
      { name: "p1", countable: true, status: "cubierta" },
      { name: "p2", countable: true, status: "sin_usar" },
      { name: "meta", countable: false, status: "no_graficable" },
    ]),
    fuente("estudiantes", [
      { name: "p1", countable: true, status: "sin_usar" },
      { name: "p2", countable: true, status: "sin_usar" },
    ]),
  ];

  test("cuenta con el mismo criterio que el resumen del backend", () => {
    const desglose = coberturaPorBase(sources);
    expect(desglose).toEqual([
      { base: "docentes", graficables: 2, incluidas: 1, pendientes: 1 },
      { base: "estudiantes", graficables: 2, incluidas: 0, pendientes: 2 },
    ]);
    // Las filas suman el total global: 1 de 4 graficables cubiertas.
    const totalGraficables = desglose.reduce((acc, f) => acc + f.graficables, 0);
    const totalIncluidas = desglose.reduce((acc, f) => acc + f.incluidas, 0);
    expect([totalIncluidas, totalGraficables]).toEqual([1, 4]);
  });

  test("señala la base que no tiene ningún gráfico", () => {
    expect(basesSinCubrir(coberturaPorBase(sources))).toEqual(["estudiantes"]);
  });

  test("una base sin variables graficables no se reporta como descubierta", () => {
    const soloMetadatos = [fuente("logs", [{ name: "uuid", countable: false, status: "no_graficable" }])];
    expect(basesSinCubrir(coberturaPorBase(soloMetadatos))).toEqual([]);
  });
});
