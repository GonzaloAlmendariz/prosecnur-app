// Mapa por rangos de una variable numérica (2026-10-16).
import { describe, expect, it } from "vitest";
import {
  asignacionDesdeTramos,
  avisoTramos,
  casosPorTramo,
  entraEnRangos,
  numericosSinRango,
  textoTramo,
  tramosDesdeMapa,
  valoresAparte,
} from "./mapaPorRangosModel";

const edades = [18, 19, 20, 21, 22, 35].map((e) => ({ codigo: String(e), etiqueta: "", n: 10 }));
const escala = [{ codigo: "1", etiqueta: "18 a 20 años" }, { codigo: "2", etiqueta: "21 años a más" }];

describe("mapa por rangos", () => {
  it("un «88 Otro» no entra a los rangos; un 88 sin etiqueta sí", () => {
    expect(entraEnRangos({ codigo: "88", etiqueta: "Otro" })).toBe(false);
    expect(entraEnRangos({ codigo: "88", etiqueta: "" })).toBe(true);
    expect(entraEnRangos({ codigo: "2020", etiqueta: "2020" })).toBe(true);
    expect(valoresAparte([{ codigo: "2020", etiqueta: "2020" }, { codigo: "88", etiqueta: "Otro" }]).map((v) => v.codigo)).toEqual(["88"]);
  });

  it("deriva los rangos del mapa guardado y deja abierto el último", () => {
    const mapa = { "18": "1", "19": "1", "20": "1", "21": "2", "22": "2", "35": "2" };
    const t = tramosDesdeMapa(edades, mapa, escala);
    expect(t.map(textoTramo)).toEqual(["18 a 20", "21 o más"]);
    expect(tramosDesdeMapa(edades, {}, escala).map((x) => [x.desde, x.destino])).toEqual([["", "1"], ["", "2"]]);
  });

  it("asigna, cuenta casos y dice lo que queda sin rango", () => {
    const t = [
      { clave: "t1", desde: "18", hasta: "20", destino: "1" },
      { clave: "t2", desde: "21", hasta: "30", destino: "2" },
    ];
    expect(asignacionDesdeTramos(edades, t)).toEqual({ "18": "1", "19": "1", "20": "1", "21": "2", "22": "2", "35": null });
    expect(casosPorTramo(edades, t)).toEqual({ t1: 30, t2: 20 });
    expect(numericosSinRango(edades, t).map((v) => v.codigo)).toEqual(["35"]);
  });

  it("avisa superposición y extremos invertidos", () => {
    expect(avisoTramos([{ clave: "a", desde: "0", hasta: "3", destino: "1" }, { clave: "b", desde: "3", hasta: "", destino: "2" }]))
      .toBe("Los rangos 1 y 2 se superponen.");
    expect(avisoTramos([{ clave: "a", desde: "5", hasta: "2", destino: "1" }])).toBe("En el rango 1, «hasta» es menor que «desde».");
    expect(avisoTramos([{ clave: "a", desde: "", hasta: "", destino: "1" }])).toBe("");
  });
});
