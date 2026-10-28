import { describe, expect, test } from "vitest";
import { focoDeListaMuestra, listaMuestraDesdeFoco } from "./listaMuestraDireccion";

describe("Hojas de ruta › Muestra: titulares o reemplazos por dirección (L19)", () => {
  test("Reemplazos viaja en el foco; Titulares no ensucia la dirección", () => {
    expect(focoDeListaMuestra("reemplazos")).toBe("reemplazos");
    expect(focoDeListaMuestra("titulares")).toBeNull();
  });

  test("sin foco, o con otro, abre Titulares", () => {
    expect(listaMuestraDesdeFoco("reemplazos")).toBe("reemplazos");
    expect(listaMuestraDesdeFoco(null)).toBe("titulares");
    expect(listaMuestraDesdeFoco("D-14")).toBe("titulares");
  });
});
