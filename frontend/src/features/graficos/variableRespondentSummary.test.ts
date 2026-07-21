import { describe, expect, test } from "vitest";
import {
  buildVariableRespondentSummary,
  formatRespondentSourceLabel,
} from "./variableRespondentSummary";

const variables = [
  { source: "Administrativos", name: "satisfaccion", n_non_empty: 12 },
  { source: "Docentes", name: "satisfaccion", n_non_empty: 24 },
  { source: "Egresados", name: "conocimiento", n_non_empty: 165 },
  { source: "Egresados", name: "recomendacion", n_non_empty: 178 },
  { source: "Estudiantes", name: "conocimiento", n_non_empty: undefined },
  { source: "Estudiantes", name: "recomendacion", n_non_empty: 93 },
];

describe("buildVariableRespondentSummary", () => {
  test("separa la disponibilidad exacta por actor sin sumar conteos", () => {
    const result = buildVariableRespondentSummary(
      ["Administrativos$satisfaccion", "Docentes$satisfaccion"],
      variables,
      true,
    );

    expect(result.groups).toEqual([
      {
        source: "Administrativos",
        variableCount: 1,
        knownCount: 1,
        status: "exact",
        minN: 12,
        maxN: 12,
      },
      {
        source: "Docentes",
        variableCount: 1,
        knownCount: 1,
        status: "exact",
        minN: 24,
        maxN: 24,
      },
    ]);
  });

  test("presenta un rango cuando las variables del mismo actor tienen N distintos", () => {
    const result = buildVariableRespondentSummary(
      ["Egresados$conocimiento", "Egresados$recomendacion"],
      variables,
      true,
    );

    expect(result.groups[0]).toMatchObject({
      source: "Egresados",
      status: "range",
      minN: 165,
      maxN: 178,
      knownCount: 2,
      variableCount: 2,
    });
  });

  test("marca metadata parcial sin convertirla en denominador", () => {
    const result = buildVariableRespondentSummary(
      ["Estudiantes$conocimiento", "Estudiantes$recomendacion"],
      variables,
      true,
    );

    expect(result.groups[0]).toMatchObject({
      source: "Estudiantes",
      status: "partial",
      minN: 93,
      maxN: 93,
      knownCount: 1,
      variableCount: 2,
    });
  });

  test("marca como desconocido al actor cuyas variables no tienen conteo", () => {
    const result = buildVariableRespondentSummary(
      ["Estudiantes$conocimiento"],
      variables,
      true,
    );

    expect(result.groups[0]).toMatchObject({
      source: "Estudiantes",
      status: "unknown",
      minN: null,
      maxN: null,
      knownCount: 0,
    });
  });

  test("deduplica variables y registra refs que no resuelven", () => {
    const result = buildVariableRespondentSummary(
      ["Egresados$conocimiento", "Egresados$conocimiento", "NoExiste$p1", "NoExiste$p1"],
      variables,
      true,
    );

    expect(result.selectedVariableCount).toBe(1);
    expect(result.unresolvedRefCount).toBe(1);
    expect(result.groups[0]).toMatchObject({ variableCount: 1, knownCount: 1, minN: 165 });
  });
});

describe("formatRespondentSourceLabel", () => {
  test("convierte sources tecnicos en etiquetas humanas y preserva acentos", () => {
    expect(formatRespondentSourceLabel("ingenieria_mecanica")).toBe("Ingenieria Mecanica");
    expect(formatRespondentSourceLabel("administrativos")).toBe("Administrativos");
    expect(formatRespondentSourceLabel("  ÁREA-de__gestión  ")).toBe("Área De Gestión");
  });
});
