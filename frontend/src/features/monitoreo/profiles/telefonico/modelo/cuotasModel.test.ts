import { describe, expect, it } from "vitest";
import { metasConProporcion, validarMetas } from "./cuotasModel";

// Las cinco sedes de ACNUR PDM con sus metas declaradas.
const PDM = [
  { value: "San Juan de Lurigancho (SJL)", universe: 614, meta: 107, effective: 109 },
  { value: "San Martín de Porres (SMP)", universe: 598, meta: 99, effective: 110 },
  { value: "Cercado de Lima", universe: 501, meta: 95, effective: 100 },
  { value: "Chorrillos", universe: 246, meta: 58, effective: 59 },
  { value: "Pueblo Libre (PL)", universe: 337, meta: 41, effective: 45 },
];

describe("Modelo › Cuotas del telefónico", () => {
  it("compara cada meta con el reparto proporcional al universo", () => {
    const filas = metasConProporcion(PDM);
    const porSede = Object.fromEntries(filas.map((fila) => [fila.value, fila]));
    expect(porSede.Chorrillos.desvio).toBe(15);
    expect(porSede["Pueblo Libre (PL)"].desvio).toBe(-18);
    expect(porSede["San Juan de Lurigancho (SJL)"].sobreUniverso).toBeCloseTo(0.174, 3);
  });

  it("valida la suma, la presencia en la hoja y el desvío mayor", () => {
    const textos = validarMetas({ filas: metasConProporcion(PDM), variable: "Sede", objetivoTotal: 400 });
    expect(textos[0]).toEqual({ tono: "ok", texto: "Las 5 metas suman 400, igual que el objetivo total declarado." });
    expect(textos.some((item) => item.tono === "ok" && /existen en la hoja/.test(item.texto))).toBe(true);
    expect(textos.at(-1)).toEqual({ tono: "aviso", texto: "Chorrillos lleva 15 más y Pueblo Libre (PL) 18 menos que un reparto proporcional al universo." });
  });

  it("avisa de categorías sin meta, metas sin base y una suma distinta del objetivo", () => {
    const textos = validarMetas({
      filas: metasConProporcion([
        { value: "A", universe: 100, meta: 50, effective: 0 },
        { value: "B", universe: 0, meta: 20, effective: 0 },
        { value: "C", universe: 80, meta: null, effective: 0 },
      ]),
      variable: "Actor",
      objetivoTotal: 100,
    }).map((item) => item.texto);
    expect(textos).toContain("Las 3 metas suman 70 y el objetivo total declarado es 100.");
    expect(textos).toContain("1 categoría sin meta: C.");
    expect(textos).toContain("B tiene meta y no aparece en la hoja.");
  });
});
