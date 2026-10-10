import { describe, expect, it } from "vitest";
import { alternarCategoria, categoriasDeEscala, estadoTop2Box } from "./top2boxSeleccion";

const escala = {
  name: "p1",
  choices: [
    { name: "1", label: "Totalmente en desacuerdo" },
    { name: "2", label: "En desacuerdo" },
    { name: "3", label: "De acuerdo" },
    { name: "4", label: "Totalmente de acuerdo" },
    { name: "99", label: "SIN INF" },
  ],
};

describe("Top Two Box de exactamente dos categorías (R14)", () => {
  it("ofrece las categorías de la escala sin las especiales", () => {
    expect(categoriasDeEscala(["p1"], () => escala)).toEqual(["Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"]);
    expect(categoriasDeEscala(["x"], () => undefined)).toEqual([]);
  });

  it("no deja pasar de dos y devuelve la selección en el orden de la escala", () => {
    const orden = categoriasDeEscala(["p1"], () => escala);
    let s = alternarCategoria([], "Totalmente de acuerdo", orden);
    s = alternarCategoria(s, "De acuerdo", orden);
    expect(s).toEqual(["De acuerdo", "Totalmente de acuerdo"]);
    expect(alternarCategoria(s, "En desacuerdo", orden)).toEqual(s);           // tercera: no entra
    expect(alternarCategoria(s, "De acuerdo", orden)).toEqual(["Totalmente de acuerdo"]);   // quitar sí
  });

  it("dice qué falta y avisa si una etiqueta guardada no es de esta escala", () => {
    const orden = categoriasDeEscala(["p1"], () => escala);
    expect(estadoTop2Box([], orden).tono).toBe("falta");
    expect(estadoTop2Box(["De acuerdo"], orden).mensaje).toBe("Elige una categoría más.");
    expect(estadoTop2Box(["De acuerdo", "Totalmente de acuerdo"], orden)).toEqual({ tono: "ok", mensaje: "Top Two Box = De acuerdo + Totalmente de acuerdo." });
    expect(estadoTop2Box(["Muy de acuerdo", "De acuerdo"], orden).tono).toBe("ajena");
  });
});
