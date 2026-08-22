/**
 * El vacío total no es el vacío parcial.
 *
 * Reparar «ningún método corrió» dejó vivo «unos sí y otros no» en
 * `SimulationSummaryPanel` (84990657). Este contrato aplica el mismo criterio a
 * las otras dos listas de las pestañas: la grilla de puntajes y las tarjetas del
 * comparador.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepresentativityMetricGrid } from "../ClassroomMethodPanels";

const metrica = (over: Record<string, unknown> = {}) => ({
  metric_id: "balance_faculty",
  metric_group: "balance",
  label: "faculty",
  score: 35,
  active: true,
  ...over,
});

const render = (metrics: unknown[]) => renderToStaticMarkup(<RepresentativityMetricGrid metrics={metrics} />);

describe("grilla de puntajes con datos parciales", () => {
  it("traduce el nombre de la dimensión venga crudo o en español", () => {
    // El motor manda «Facultad» aquí y `faculty` crudo en la tabla de balance
    // del MISMO payload; la UI no puede depender de cuál toque.
    expect(render([metrica({ label: "faculty" })])).toContain("Facultad");
    expect(render([metrica({ label: "program" })])).toContain("Programa");
    expect(render([metrica({ label: "Facultad" })])).toContain("Facultad");
  });

  it("con unas métricas medidas y otras sin puntaje, pinta las medidas", () => {
    const html = render([metrica(), metrica({ metric_id: "balance_sex", label: "sex", score: null })]);
    expect(html).toContain("Facultad");
    expect(html).toContain("35");
  });

  it("una métrica sin puntaje NO se pinta como cero", () => {
    // Un 0/100 y un «no se midió» son cosas distintas: el primero es un
    // resultado malo, el segundo es la ausencia de resultado.
    const html = render([metrica({ score: null }), metrica({ metric_id: "b2", label: "sex", score: null })]);
    expect(html).not.toContain("0/100");
  });

  it("si NINGUNA métrica tiene puntaje, el bloque desaparece del todo", () => {
    // Documenta el comportamiento actual: `return null`. No es un vacío
    // declarado, pero tampoco pinta datos falsos; el encabezado «Balance» y su
    // glosa viven dentro, así que se van con él y no queda un título huérfano.
    const html = render([metrica({ score: null })]);
    expect(html).toBe("");
  });

  it("un score fuera de rango no rompe la barra", () => {
    const html = render([metrica({ score: 320 }), metrica({ metric_id: "b3", label: "sex", score: -40 })]);
    expect(html).toContain("width:100%");
    expect(html).toContain("width:0%");
  });
});
