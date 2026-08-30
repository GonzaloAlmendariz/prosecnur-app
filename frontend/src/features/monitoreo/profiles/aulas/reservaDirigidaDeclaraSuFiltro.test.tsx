import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasReservaDirigida } from "./AulasReservaDirigida";

/**
 * El motor filtra esta lista por `estado ∈ {deficit_proyectado,
 * deficit_no_subsanable}`: por el déficit PROYECTADO, no por la falta de hoy.
 *
 * Medido sobre el estudio real: **1 grupo en la lista y 9 por debajo de su
 * cuota**, con 170 encuestas de falta. Una celda que hoy está 38 encuestas corta
 * pero que se espera que cierre sola queda fuera —«asegurada», «ajustada»—.
 *
 * El filtro es deliberado y estas pruebas NO lo discuten: fijan que la pantalla
 * lo diga. «1 grupo de cuota que hoy no llega» se leía como que sólo falta uno.
 */
const celda = (brecha: number) => ({
  faculty: "EDUCACION", sex: "M", brecha, candidatos: [],
  aporte_de_los_candidatos: 0, alcanza: false, etiqueta: "",
}) as never;

describe("la reserva dirigida dice sobre qué actúa", () => {
  it("nombra el déficit proyectado, no «lo que hoy no llega»", () => {
    const html = renderToStaticMarkup(<AulasReservaDirigida celdas={[celda(1)]} porDebajoHoy={9} />);
    expect(html).toContain("con déficit proyectado");
    expect(html).not.toContain("que hoy no llega");
  });

  it("y cuánto falta hoy de verdad, que es el número que el filtro esconde", () => {
    const html = renderToStaticMarkup(<AulasReservaDirigida celdas={[celda(1)]} porDebajoHoy={9} />);
    expect(html).toContain("9 están hoy por debajo de su cuota");
  });

  it("sin diferencia entre ambos no añade la coletilla: sería ruido", () => {
    const html = renderToStaticMarkup(<AulasReservaDirigida celdas={[celda(1)]} porDebajoHoy={1} />);
    expect(html).toContain("con déficit proyectado");
    expect(html).not.toContain("por debajo de su cuota");
  });

  it("sin el dato tampoco inventa nada", () => {
    const html = renderToStaticMarkup(<AulasReservaDirigida celdas={[celda(1)]} />);
    expect(html).not.toContain("por debajo de su cuota");
  });
});
