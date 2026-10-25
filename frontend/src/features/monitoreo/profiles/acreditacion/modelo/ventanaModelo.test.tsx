import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MonitoreoStrategyPhase } from "../../../../../api/client";
import { construirVentana, diasEntre, posicion } from "./ventanaModelo";
import { VentanaDeCampo } from "./VentanaDeCampo";

const actores = [
  { Actor: "Docentes", "Primer día": "2026-10-05", "Última efectiva": "2026-10-12", Efectivas: 40 },
  { Actor: "Estudiantes", "Primer día": "2026-10-01", "Última efectiva": "2026-10-10", Efectivas: 120 },
  { Actor: "Egresados", Efectivas: 0 },
];
const diarioGeneral = [
  { Fecha: "2026-10-01", Efectivas: 10 },
  { Fecha: "2026-10-02", Efectivas: 0 },
  { Fecha: "2026-10-05", Efectivas: 30 },
];
const diarioPorPublico = [
  { Actor: "Estudiantes", Fecha: "2026-10-01", Efectivas: 10 },
  { Actor: "Docentes", Fecha: "2026-10-05", Efectivas: 20 },
];
const fase = (parcial: Partial<MonitoreoStrategyPhase>) => ({ id: "f1", stratum: "Fase 1", modality: "virtual", start_week: 1, end_week: 2, ...parcial }) as MonitoreoStrategyPhase;

describe("Modelo › Ventana de campo", () => {
  it("ordena los públicos por su primer día y deja al final los que no tienen respuestas", () => {
    const modelo = construirVentana(actores, diarioGeneral, diarioPorPublico, []);
    expect(modelo.publicos.map((item) => item.publico)).toEqual(["Estudiantes", "Docentes", "Egresados"]);
    expect(modelo.desde).toBe("2026-10-01");
    expect(modelo.hasta).toBe("2026-10-12");
    expect(modelo.diasDelCampo).toBe(12);
    expect(modelo.diasConEfectivas).toBe(2);
  });

  it("toma solo las fases con fechas y extiende la ventana al plan", () => {
    const modelo = construirVentana(actores, diarioGeneral, diarioPorPublico, [
      fase({ start_date: "2026-09-28", end_date: "2026-10-15" }),
      fase({ id: "f2", stratum: "Sin fecha" }),
    ]);
    expect(modelo.fases).toHaveLength(1);
    expect(modelo.fasesDeclaradas).toBe(2);
    expect(modelo.desde).toBe("2026-09-28");
    expect(modelo.hasta).toBe("2026-10-15");
  });

  it("calcula días y posiciones en la ventana", () => {
    expect(diasEntre("2026-10-01", "2026-10-11")).toBe(10);
    expect(posicion("2026-10-11", "2026-10-01", 11)).toBe(100);
    expect(posicion("2026-10-01", "2026-10-01", 1)).toBe(0);
  });

  it("dibuja la línea de tiempo con fechas legibles, sin claves técnicas, y el editor debajo", () => {
    const html = renderToStaticMarkup(<VentanaDeCampo modelo={construirVentana(actores, diarioGeneral, diarioPorPublico, [])} editorDelPlan={<p>Editor del plan</p>} />);
    expect(html).toContain("Plan de campo");
    expect(html).toContain("Sin fases con fechas");
    expect(html).toContain("Sin respuestas");
    expect(html).toContain("Editor del plan");
    expect(html).not.toMatch(/strategy_phases|daily_actor|2026-10-01/);
  });

  it("sin respuestas con fecha avisa con el vacío del sistema, dentro de su tarjeta", () => {
    const html = renderToStaticMarkup(<VentanaDeCampo modelo={construirVentana([], [], [], [])} />);
    expect(html).toContain("pulso-estado-vacio");
    expect(html).toContain("acr-av-panel");
    expect(html).toContain("todavía no trae respuestas con fecha");
  });
});
