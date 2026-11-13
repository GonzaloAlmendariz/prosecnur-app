import { describe, expect, it } from "vitest";
import { ApiError } from "../../../api/core";
import { mensajeSinCodigo } from "./mensajeSinCodigo";

describe("aviso de carga sin el código del error (ítem 45.9)", () => {
  it("quita el código que el cliente agrega al final", () => {
    const e = new ApiError("E_DATA_XLSFORM_INCOMPATIBLE", "Las respuestas no calzan con el formulario.");
    expect(e.message).toContain("E_DATA_XLSFORM_INCOMPATIBLE");
    expect(mensajeSinCodigo(e.message)).toBe("Las respuestas no calzan con el formulario.");
  });

  it("deja igual un mensaje sin código y no toca un código que está a mitad de frase", () => {
    expect(mensajeSinCodigo("No se pudo leer el archivo.")).toBe("No se pudo leer el archivo.");
    expect(mensajeSinCodigo("El error E_X ocurrió al leer.")).toBe("El error E_X ocurrió al leer.");
  });
});
