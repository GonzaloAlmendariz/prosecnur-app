import { describe, expect, test } from "vitest";
import { variableCoverageRef } from "./usePlanCoverage";

describe("variableCoverageRef", () => {
  test("usa refs simples en base default y refs calificadas en multibase", () => {
    const variable = {
      name: "p9_recod",
      label: "Institución recodificada",
      tipo: "select_one",
      seccion: "",
      status: "sin_usar",
    };

    expect(variableCoverageRef("default", variable)).toBe("p9_recod");
    expect(variableCoverageRef("ingenieria_civil", variable)).toBe("ingenieria_civil$p9_recod");
  });
});
