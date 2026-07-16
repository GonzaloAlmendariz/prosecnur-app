import { describe, expect, it } from "vitest";

import { splitErrorDetail } from "./errorPresentation";

describe("splitErrorDetail", () => {
  it("separa mensaje y código del formato canónico «mensaje · E_CODE»", () => {
    expect(splitErrorDetail("La base no existe · E_BASE_NOT_FOUND")).toEqual({
      message: "La base no existe",
      code: "E_BASE_NOT_FOUND",
    });
  });

  it("reconoce códigos HTTP_ del fallback de handle()", () => {
    expect(splitErrorDetail("Internal Server Error · HTTP_500")).toEqual({
      message: "Internal Server Error",
      code: "HTTP_500",
    });
  });

  it("usa el ÚLTIMO separador cuando el mensaje contiene «·»", () => {
    expect(splitErrorDetail("Paso 2 · sin filas válidas · E_NO_ROWS")).toEqual({
      message: "Paso 2 · sin filas válidas",
      code: "E_NO_ROWS",
    });
  });

  it("normaliza el formato legado «[E_CODE] mensaje» al orden del contrato", () => {
    expect(splitErrorDetail("[E_NO_DIM] No hay dimensiones construidas")).toEqual({
      message: "No hay dimensiones construidas",
      code: "E_NO_DIM",
    });
  });

  it("nunca deja el código como único contenido", () => {
    const canonico = splitErrorDetail(" · E_SOLO_CODIGO");
    expect(canonico.code).toBe("E_SOLO_CODIGO");
    expect(canonico.message.length).toBeGreaterThan(0);
    expect(canonico.message).not.toContain("E_SOLO_CODIGO");

    const legado = splitErrorDetail("[E_SOLO_CODIGO]");
    expect(legado.code).toBe("E_SOLO_CODIGO");
    expect(legado.message.length).toBeGreaterThan(0);
  });

  it("devuelve el texto tal cual cuando no hay código", () => {
    expect(splitErrorDetail("No se pudo guardar el plan")).toEqual({
      message: "No se pudo guardar el plan",
      code: null,
    });
  });

  it("soporta mensajes multilínea de R antes del código", () => {
    expect(splitErrorDetail("línea 1\nlínea 2 · E_MULTI")).toEqual({
      message: "línea 1\nlínea 2",
      code: "E_MULTI",
    });
  });

  it("no confunde un «·» sin código al final", () => {
    expect(splitErrorDetail("promedio · 3.4")).toEqual({
      message: "promedio · 3.4",
      code: null,
    });
  });
});
