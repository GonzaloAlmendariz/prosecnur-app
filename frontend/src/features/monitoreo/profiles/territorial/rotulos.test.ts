import { describe, expect, it } from "vitest";
import { nombreDeDistrito, enumerar } from "./rotulos";

describe("nombreDeDistrito", () => {
  it("pone tildes y mayúsculas de nombre propio", () => {
    expect(nombreDeDistrito("SAN MARTIN DE PORRES")).toBe("San Martín de Porres");
  });

  it("no deja pasar la clave del grupo sin cruce", () => {
    expect(nombreDeDistrito("sin_cruce_ump")).toBe("UMP sin cruce con la ruta");
    expect(nombreDeDistrito("Sin cruce UMP")).toBe("UMP sin cruce con la ruta");
  });

  it("enumera en frase, sin «·» y sin vacíos", () => {
    expect(enumerar(["distritos PlanMet", "manzanas INEI 2017", "calles OpenStreetMap"])).toBe("distritos PlanMet, manzanas INEI 2017 y calles OpenStreetMap");
    expect(enumerar(["manzanas INEI 2017", "", false, "GPS de Kobo"])).toBe("manzanas INEI 2017 y GPS de Kobo");
    expect(enumerar(["solo"])).toBe("solo");
    expect(enumerar([])).toBe("");
  });
});
