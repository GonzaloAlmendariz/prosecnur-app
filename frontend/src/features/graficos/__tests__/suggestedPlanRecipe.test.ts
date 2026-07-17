import { describe, expect, test } from "vitest";
import type { GraficosReportInputs } from "../../../api/client";
import { buildSuggestedPlanRecipeMarkdown } from "../suggestedPlanRecipe";

const inputs: GraficosReportInputs = {
  period: "30 jun. – 6 jul. 2026",
  period_source: "manual",
  technical_rows: [
    { criterio: "Metodología", detalle: "Selección aleatoria de manzanas" },
  ],
  derived_variables: [
    {
      name: "__age_group",
      label: "Grupo de edad",
      origin: "Calculada a partir de la edad",
      source: "principal",
    },
  ],
  profile: {
    available: true,
    sex_variable: "sexo_recod",
    age_variable: "edad_recod",
  },
  map_included: true,
  comparison_mode: "paired_district",
};

describe("buildSuggestedPlanRecipeMarkdown", () => {
  test("documenta los mismos insumos visibles en la propuesta", () => {
    const markdown = buildSuggestedPlanRecipeMarkdown(inputs, { acnurMode: "territorial" });

    expect(markdown).toContain("# Guía del informe ACNUR");
    expect(markdown).toContain("Periodo: 30 jun. – 6 jul. 2026");
    expect(markdown).toContain("Origen del periodo: Definido manualmente");
    expect(markdown).toContain("| Metodología | Selección aleatoria de manzanas |");
    expect(markdown).toContain("| __age_group | Grupo de edad | Calculada a partir de la edad | principal |");
    expect(markdown).toContain("Variable de sexo: sexo_recod");
    expect(markdown).toContain("Mapa territorial: Sí");
    expect(markdown).toContain("Modalidad: Territorial");
    expect(markdown).toContain("Procesamiento > Gráficos");
  });

  test("escapa barras verticales dentro de una celda", () => {
    const markdown = buildSuggestedPlanRecipeMarkdown({
      ...inputs,
      technical_rows: [{ criterio: "Cobertura", detalle: "Lima Norte | Lima Sur" }],
    });

    expect(markdown).toContain("Lima Norte \\| Lima Sur");
  });

  test("nombra el periodo observado como un cálculo desde la base", () => {
    const markdown = buildSuggestedPlanRecipeMarkdown({ ...inputs, period_source: "observed" });

    expect(markdown).toContain("Origen del periodo: Calculado desde la base");
  });
});
