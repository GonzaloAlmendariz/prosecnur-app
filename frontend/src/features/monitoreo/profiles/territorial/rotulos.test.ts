import { describe, expect, it } from "vitest";
import { nombreDeDistrito } from "./rotulos";

describe("nombreDeDistrito", () => {
  it("pone tildes y mayúsculas de nombre propio", () => {
    expect(nombreDeDistrito("SAN MARTIN DE PORRES")).toBe("San Martín de Porres");
  });

  it("no deja pasar la clave del grupo sin cruce", () => {
    expect(nombreDeDistrito("sin_cruce_ump")).toBe("UMP sin cruce con la ruta");
    expect(nombreDeDistrito("Sin cruce UMP")).toBe("UMP sin cruce con la ruta");
  });
});
