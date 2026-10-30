import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../../api/client";
import { conSuRespuesta, duracionesFueraDeRango, duracionLegible } from "./calidadModelo";
import { Calidad, CalidadVista } from "./Calidad";

describe("Control › Calidad", () => {
  it("cada duración se une con su respuesta por la fila del corte", () => {
    const duraciones = duracionesFueraDeRango([
      { id: "2668", row: 2668, tipo: "duracion_muy_corta", valor: "4" },
      { id: "9999", row: 9999, tipo: "duracion_muy_corta", valor: "8" },
      { id: "77", tipo: "duracion_muy_corta", valor: "9" },
    ], 60, 7200);
    const unidas = conSuRespuesta(duraciones, [
      { response_row: 2668, response_id: "115202952682", actor: "Profesores", platform_state: "Parcial" },
      { response_row: "", response_id: "otro", actor: "X", platform_state: "Completa" },
    ]);
    expect(unidas[0]).toMatchObject({ id: "2668", respuesta: "115202952682", publico: "Profesores", estado: "Parcial" });
    // Sin caso para la fila, o sin fila, queda como venía.
    expect(unidas[1].respuesta).toBeUndefined();
    expect(unidas[2]).toEqual({ id: "77", segundos: 9, tipo: "corta" });
  });

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

  it("revisa las cortas y deja las largas como dato neutro, fuera de lo que se revisa", () => {
    const state = { config: { min_duration_seconds: 60, max_duration_seconds: 7200 }, dashboard: { inconsistencies: [
      { id: "813", tipo: "duracion_muy_corta", valor: "45" },
      { id: "900", tipo: "duracion_muy_larga", valor: "855360" },
    ] } } as unknown as MonitoreoState;
    const html = renderToStaticMarkup(<Calidad reports={{ schema: "t", generated_at: "", reference_tabs: [], sheets: [] } as unknown as MonitoreoAcreditacionReports} state={state} />);
    expect(html).toContain("Menos de 1 min");
    expect(html).toContain("Más de 2 h, no se revisan");
    expect(html).toContain("Muy corta");
    expect(html).not.toContain("Muy larga");
    expect(html).not.toContain("900");
  });

  it("sin la bandeja Público y Estado dicen «Uniendo…»; si falló, «Sin dato» y el aviso", () => {
    const duraciones = [{ id: "2668", segundos: 4, tipo: "corta" as const, fila: 2668 }];
    const uniendo = renderToStaticMarkup(<CalidadVista duraciones={duraciones} minimo={60} maximo={7200} senales={[]} union="uniendo" />);
    expect(uniendo).toContain("Uniendo…");
    expect(uniendo).not.toMatch(/<td>—<\/td>/);
    const fallo = renderToStaticMarkup(<CalidadVista duraciones={duraciones} minimo={60} maximo={7200} senales={[]} union="fallo" />);
    expect(fallo).toContain("Sin dato");
    expect(fallo).toContain("No llegó la bandeja de respuestas");
  });
});
