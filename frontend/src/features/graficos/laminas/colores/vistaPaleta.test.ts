// Mata: una muestra que pinta las respuestas de otra pregunta, que pierde el color propio de una respuesta que la paleta
// no nombra o que calla cuántas preguntas cambian.
import { describe, expect, it } from "vitest";
import { alcanceDeLaPaleta, coloresConPaleta, muestrasEnOrden, respuestasEnComun } from "./vistaPaleta";

describe("muestras de la paleta sobre esta pregunta", () => {
  it("la paleta pinta las respuestas que nombra, sin distinguir caja ni tildes; las demás conservan su color", () => {
    const destino = { colores: { "si": "#111111", "NO": "#222222", "Otra": "#999999" } };
    expect(coloresConPaleta(["Sí", "No", "No sabe"], { "No sabe": "#cccccc" }, destino))
      .toEqual({ "Sí": "#111111", "No": "#222222", "No sabe": "#cccccc" });
  });
  it("una respuesta sin color en ninguna parte queda sin color (la muestra la pinta rayada)", () => {
    expect(coloresConPaleta(["Sí", "Tal vez"], {}, { colores: { "Sí": "#111111" } })).toEqual({ "Sí": "#111111" });
  });
  it("el alcance antes del clic", () => {
    expect(alcanceDeLaPaleta(true, 4)).toBe("En uso");
    expect(alcanceDeLaPaleta(false, 1)).toBe("Cambia 1 pregunta");
    expect(alcanceDeLaPaleta(false, 3)).toBe("Cambia 3 preguntas");
  });
  it("R6-3: cuenta las respuestas que la paleta nombra y deja al final las que no nombra ninguna", () => {
    const sino = { id: "a", colores: { "si": "#111111" } };
    const ajena = { id: "b", colores: { "Muy de acuerdo": "#333333" } };
    const otra = { id: "c", colores: { "No": "#222222" } };
    expect(respuestasEnComun(["Sí", "No"], sino)).toBe(1);
    expect(respuestasEnComun(["Sí", "No"], ajena)).toBe(0);
    expect(muestrasEnOrden(["Sí", "No"], [ajena, sino, otra]).map((m) => [m.paleta.id, m.ajena]))
      .toEqual([["a", false], ["c", false], ["b", true]]);
  });
});
