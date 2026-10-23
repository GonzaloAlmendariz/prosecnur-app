import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../../api/client";
import { duracionesFueraDeRango, duracionLegible } from "./calidadModelo";
import { Calidad } from "./Calidad";

describe("Control › Calidad", () => {
  it("clasifica cada duración por su valor frente al rango (H1)", () => {
    const filas = [
      { id: "813", tipo: "duracion_muy_corta", valor: "45" },
      { id: "900", tipo: "duracion_muy_corta", valor: "855360" },
      { id: "901", tipo: "estado_invalido", valor: "" },
    ];
    expect(duracionesFueraDeRango(filas, 60, 7200)).toEqual([
      { id: "813", segundos: 45, tipo: "corta" },
      { id: "900", segundos: 855360, tipo: "larga" },
    ]);
    expect([duracionLegible(45), duracionLegible(606), duracionLegible(7200), duracionLegible(855360)]).toEqual(["45 s", "10.1 min", "2 h", "9.9 días"]);
  });

  it("la vista no muestra claves crudas aunque la hoja las traiga", () => {
    const reports = {
      schema: "t", generated_at: "", reference_tabs: [],
      sheets: [{ id: "alertas", title: "Alertas", blocks: [{ id: "alertas", title: "Alertas", columns: [], rows: [
        { Nivel: "Alta", Tipo: "efectiva_sin_cruce_base", Freq: 47 },
        { Nivel: "Media", Tipo: "responsable_sin_barrido", Responsable: "Responsable 6", Freq: 5 },
      ] }] }],
    } as unknown as MonitoreoAcreditacionReports;
    const state = { config: { min_duration_seconds: 60, max_duration_seconds: 7200 }, dashboard: { inconsistencies: [{ id: "813", tipo: "duracion_muy_corta", valor: "45" }] } } as unknown as MonitoreoState;
    const html = renderToStaticMarkup(<Calidad reports={reports} state={state} />);
    expect(html).toContain("Muy corta");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });
});
