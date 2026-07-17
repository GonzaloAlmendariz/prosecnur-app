import { describe, expect, test } from "vitest";
import {
  derivedReportVariableName,
  getDerivedReportVariable,
  isDerivedReportVariableRef,
} from "../derivedReportVariables";
import { _checkVarRefs } from "../usePlanValidator";

describe("derivedReportVariables", () => {
  test("reconoce las variables calculadas con y sin prefijo de base", () => {
    expect(isDerivedReportVariableRef("__age_group")).toBe(true);
    expect(isDerivedReportVariableRef("principal$__territory_pair")).toBe(true);
    expect(derivedReportVariableName("principal$__district")).toBe("__district");
    expect(getDerivedReportVariable("__age_group")?.label).toBe("Grupo de edad");
  });

  test("no confunde variables ordinarias con variables del informe", () => {
    expect(isDerivedReportVariableRef("edad")).toBe(false);
    expect(isDerivedReportVariableRef("principal$distrito")).toBe(false);
  });

  test("el validador no marca una variable calculada como desconocida", () => {
    const unknown = _checkVarRefs({
      graficador: "barras_agrupadas",
      args: {
        var: "__age_group",
        cruce: "principal$__territory_pair",
        vars: ["sexo", "variable_inexistente"],
      },
    }, new Set(["sexo"]));

    expect(unknown).toEqual(["variable_inexistente"]);
  });
});

