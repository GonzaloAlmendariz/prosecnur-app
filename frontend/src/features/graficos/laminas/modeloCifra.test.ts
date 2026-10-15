// La tarjeta de la cifra ofrece sólo los modos que la pregunta admite. Mata: ofrecer media a una pregunta con opciones,
// porcentaje a una medida, o esconder el modo guardado cuando ya no corresponde (no se podría ver ni cambiar).
import { describe, expect, it } from "vitest";
import { modosCifraDisponibles } from "./modeloCifra";

const claves = (xs: { clave: string }[]) => xs.map((x) => x.clave);

describe("modos de la cifra destacada", () => {
  it("con opciones, porcentaje y respuestas; sin opciones, media, mediana y respuestas", () => {
    expect(claves(modosCifraDisponibles(true, "porcentaje"))).toEqual(["porcentaje", "n"]);
    expect(claves(modosCifraDisponibles(false, "media"))).toEqual(["n", "media", "mediana"]);
  });
  it("mientras se leen las respuestas, todos", () => {
    expect(claves(modosCifraDisponibles(null, "porcentaje"))).toEqual(["porcentaje", "n", "media", "mediana"]);
  });
  it("el modo guardado queda aunque ya no corresponda", () => {
    expect(claves(modosCifraDisponibles(true, "media"))).toEqual(["porcentaje", "n", "media"]);
  });
});
