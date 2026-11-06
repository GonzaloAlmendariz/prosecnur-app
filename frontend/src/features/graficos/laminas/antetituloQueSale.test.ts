import { describe, expect, it } from "vitest";
import { antetituloQueSale } from "./antetituloQueSale";

describe("antetituloQueSale (como `.lam_antetitulos` del motor)", () => {
  it("el escrito por el analista sale siempre, con la opción encendida o apagada", () => {
    expect(antetituloQueSale("Cómo leer", "PRINCIPALES RESULTADOS", false)).toBe("Cómo leer");
    expect(antetituloQueSale("Cómo leer", "PRINCIPALES RESULTADOS", true)).toBe("Cómo leer");
  });
  it("sin uno propio, el nombre de la sección sólo con «Nombre de la sección» encendida (apagada por defecto)", () => {
    expect(antetituloQueSale("", "PRINCIPALES RESULTADOS", false)).toBeNull();
    expect(antetituloQueSale(undefined, "PRINCIPALES RESULTADOS", true)).toBe("PRINCIPALES RESULTADOS");
    expect(antetituloQueSale("  ", null, true)).toBeNull();
  });
});
