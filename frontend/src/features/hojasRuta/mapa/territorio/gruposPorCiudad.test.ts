import { describe, expect, it } from "vitest";
import { gruposPorCiudad } from "./gruposPorCiudad";

// Arequipa (0401xx), Lima (1501xx), Trujillo (1301xx).
const filas = [{ u: "040101" }, { u: "150103" }, { u: "040103" }, { u: "130101" }, { u: "150101" }];

describe("distritos agrupados por ciudad", () => {
  it("cada ciudad junta sus distritos y respeta el orden de la lista dentro del grupo", () => {
    const g = gruposPorCiudad(filas, (f) => f.u);
    expect(g.map((x) => x.nombre)).toEqual(["Arequipa", "Lima y Callao", "Trujillo"]);
    expect(g[0].items.map((f) => f.u)).toEqual(["040101", "040103"]);
    expect(g[1].items.map((f) => f.u)).toEqual(["150103", "150101"]);
  });

  it("los grupos van en el orden en que se eligieron sus ciudades", () => {
    const g = gruposPorCiudad(filas, (f) => f.u, ["130101", "150101", "040101"]);
    expect(g.map((x) => x.nombre)).toEqual(["Trujillo", "Lima y Callao", "Arequipa"]);
  });

  it("un distrito fuera de las ciudades del atlas va a «Otros distritos»", () => {
    expect(gruposPorCiudad([{ u: "999999" }], (f) => f.u)[0].nombre).toBe("Otros distritos");
  });
});
