/**
 * Simulación CON corridas: el estado principal de la pestaña, nunca observado.
 *
 * HSVG2026 tiene `simulation_runs: 0`, así que en todo el loop la pestaña se vio
 * siempre vacía: las tarjetas de resultados, el rango de puntajes y la nota del
 * motor no se han mirado ni una vez en pantalla.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SimulationSummaryPanel } from "../ClassroomMethodPanels";

const fila = (over: Record<string, unknown> = {}) => ({
  method_id: "cube_balanceado",
  score_mean: 52.2,
  score_p10: 49.1,
  score_p90: 54.8,
  executed_runs: 500,
  requested_runs: 500,
  note: "Simulacion completa",
  ...over,
});

const render = (rows: unknown[]) => renderToStaticMarkup(<SimulationSummaryPanel rows={rows} />);

describe("Simulación con corridas hechas", () => {
  it("la tarjeta usa el nombre canónico del método, no el del motor", () => {
    const html = render([fila()]);
    expect(html).toContain("Balance por cuotas y tamaño");
    expect(html).not.toContain("Selección balanceada");
  });

  it("el rango deja de ser una barra muda y dice qué representa", () => {
    const html = render([fila()]);
    expect(html).toContain("8 de cada 10");
    expect(html).toContain("49");
    expect(html).toContain("55");
  });

  it("dice cuántos sorteos hay detrás del puntaje", () => {
    expect(render([fila()])).toContain("puntaje medio de 500 sorteos");
  });

  it("cada tarjeta explica qué hace su método", () => {
    // La explicación existía en las constantes y no se pintaba en Simulación.
    expect(render([fila()])).toContain("sortea de forma que el reparto");
  });

  it("si NINGÚN método corrió, el vacío se declara una vez y no cuatro", () => {
    const sinCorrer = ["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"]
      .map((id) => fila({ method_id: id, executed_runs: 0, requested_runs: 0, note: "Simulacion no solicitada" }));
    const html = render(sinCorrer);
    expect(html).toContain("Todavía no se ha repetido el sorteo");
    expect(html).toContain("Medir estabilidad");
    // El defecto era exactamente esto: cuatro tarjetas con el mismo vacío.
    expect(html.split("Simulación no solicitada").length - 1).toBe(0);
  });

  it("con unos corridos y otros no, el que no corrió no inventa una media ni un rango", () => {
    // El vacío único cubre «ninguno corrió»; este es el caso MIXTO, que la app
    // no alcanza y quedó vivo: la tarjeta del método sin simular decía «puntaje
    // medio de 0 sorteos» y «8 de cada 10 cayeron entre — y —».
    const mixto = [fila(), fila({
      method_id: "pool_controlado", executed_runs: 0, requested_runs: 0,
      score_mean: null, score_p10: null, score_p90: null, note: "Simulacion no solicitada",
    })];
    const html = render(mixto);
    expect(html).not.toContain("Todavía no se ha repetido el sorteo");
    expect(html).toContain("Balance por cuotas y tamaño");
    expect(html).toContain("no se simuló");
    expect(html).not.toContain("puntaje medio de 0 sorteos");
    expect(html).not.toContain("entre — y —");
  });

  it("el método que sí corrió conserva su media y su rango en el caso mixto", () => {
    const html = render([fila(), fila({ method_id: "pool_controlado", executed_runs: 0, score_mean: null })]);
    expect(html).toContain("puntaje medio de 500 sorteos");
    expect(html).toContain("8 de cada 10");
  });
});
