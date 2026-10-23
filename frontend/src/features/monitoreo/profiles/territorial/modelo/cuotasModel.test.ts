import { describe, expect, it } from "vitest";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirCuotas, textoDePlantilla } from "./cuotasModel";
import { CORTE_DE_CUOTAS } from "../avance/fixtures/corteDeCuotas";

const STATE = { config: { territorial: { sex_var: "Core/E2_sex", age_var: "Core/E1_age" } } } as unknown as MonitoreoState;

describe("Modelo › Cuotas", () => {
  const modelo = construirCuotas(CORTE_DE_CUOTAS, STATE);

  it("la plantilla por UMP es la que usan las manzanas, con su total de entrevistas", () => {
    expect(textoDePlantilla(modelo.plantilla)).toBe("Hombre 4 · Mujer 4 · 18 a 29 2 · 30 a 44 3 · 45 a 59 2 · 60 o más 1");
    expect(modelo.entrevistasPorUmp).toBe(8);
    expect(modelo.conPlantilla + modelo.conOtra).toBe(4);
  });

  it("las variables de cuota dicen de qué columna salen", () => {
    expect(modelo.variables).toEqual([
      { rotulo: "Sexo", columna: "Core/E2_sex", categorias: ["Hombre", "Mujer"] },
      { rotulo: "Edad", columna: "Core/E1_age", categorias: ["18 a 29", "30 a 44", "45 a 59", "60 o más"] },
    ]);
  });

  it("la cuota por distrito sigue las columnas de la plantilla y suma su total", () => {
    expect(modelo.distritos.map((fila) => [fila.distrito, fila.metas, fila.total])).toEqual([
      ["San Juan de Lurigancho", [100, 100, 50, 75, 50, 25], 200],
      ["San Martín de Porres", [100, 100, 50, 75, 50, 25], 200],
    ]);
    expect(modelo.total).toEqual({ distrito: "Total", metas: [200, 200, 100, 150, 100, 50], total: 400 });
  });

  it("las reglas de cobertura salen de los déficits del motor; sin ellas, sin dato", () => {
    expect(modelo.reglas).toEqual({ sexoFlexible: null, edadFlexible: null });
    const conReglas = construirCuotas({
      ...CORTE_DE_CUOTAS,
      operational_adjustments: { deficits: [{ sex_flexible: true, age_flexible: false }] },
    } as unknown as MonitoreoTerritorialDashboard, STATE);
    expect(conReglas.reglas).toEqual({ sexoFlexible: true, edadFlexible: false });
  });

  it("sin cuota configurada no hay modelo", () => {
    expect(construirCuotas(null, STATE).disponible).toBe(false);
  });
});
