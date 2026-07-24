import { describe, expect, it } from "vitest";
import {
  PULSO_DASHBOARD_SEQUENTIAL,
  dashboardSeriesColor,
} from "./pulsoDashboardPalette";

describe("paleta secuencial Pulso del Dashboard", () => {
  it("usa la intensidad navy canónica como paleta default, nunca el arcoíris de Plotly", () => {
    expect(PULSO_DASHBOARD_SEQUENTIAL).toEqual([
      "#DBE8FF",
      "#7AA2F8",
      "#2457D6",
      "#002457",
    ]);

    expect(
      ["A", "B", "C", "D"].map((label, index) =>
        dashboardSeriesColor(index, label),
      ),
    ).toEqual(PULSO_DASHBOARD_SEQUENTIAL);
  });

  it("repite la escala de forma estable cuando hay más categorías que tonos", () => {
    expect(dashboardSeriesColor(4, "E")).toBe("#DBE8FF");
    expect(dashboardSeriesColor(5, "F")).toBe("#7AA2F8");
  });

  it("mantiene precedencia de la paleta custom por etiqueta", () => {
    const custom = {
      Aprobado: "#123456",
      Observado: "#ABCDEF",
    };

    expect(dashboardSeriesColor(0, "Aprobado", custom)).toBe("#123456");
    expect(dashboardSeriesColor(1, "Observado", custom)).toBe("#ABCDEF");
    expect(dashboardSeriesColor(2, "Sin override", custom)).toBe("#2457D6");
  });
});
