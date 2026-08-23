// Recopiladores ya avisaba de que su plan venía de otra corrida del sorteo.
// Monitoreo no, y es DONDE SE MIRA EL AVANCE DEL CAMPO: se re-sortea y esta
// pantalla sigue enseñando el avance de un plan que ya no existe.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AulasOrigenDesfasado, fechaDeCorrida } from "./AulasOrigenDesfasado";

const render = (origen: Parameters<typeof AulasOrigenDesfasado>[0]["origen"]) =>
  renderToStaticMarkup(<AulasOrigenDesfasado origen={origen} />);

describe("AulasOrigenDesfasado", () => {
  it("avisa cuando el plan viene de otra corrida, con las dos fechas", () => {
    const html = render({
      plan_run_id: "sel_aulas_20260801093000_aaaa1111",
      selection_run_id: "sel_aulas_20260821160928_bf10d14c",
      desfasado: true,
    });
    expect(html).toContain("otra corrida del sorteo");
    expect(html).toContain("1 de agosto");
    expect(html).toContain("21 de agosto");
    // Dice qué hacer, no sólo que algo pasa.
    expect(html).toContain("vuelve a importar el plan");
  });

  it("sin desfase no pinta nada", () => {
    expect(render({ plan_run_id: "a", selection_run_id: "a", desfasado: false })).toBe("");
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });

  it("un id sin fecha legible no rompe el aviso", () => {
    const html = render({ plan_run_id: "raro", selection_run_id: "otro", desfasado: true });
    expect(html).toContain("otra corrida del sorteo");
    expect(html).not.toContain("Invalid");
    expect(html).not.toContain("(del )");
  });
});

describe("fechaDeCorrida", () => {
  it("saca la fecha del id de corrida", () => {
    expect(fechaDeCorrida("sel_aulas_20260821160928_bf10d14c")).toContain("21 de agosto");
  });

  it("un id que no tiene esa forma devuelve vacío", () => {
    expect(fechaDeCorrida("cualquier-cosa")).toBe("");
    expect(fechaDeCorrida(undefined)).toBe("");
  });
});
