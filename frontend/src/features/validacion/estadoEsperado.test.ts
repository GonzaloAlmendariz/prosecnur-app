import { describe, expect, it } from "vitest";

import { ApiError } from "../../api/core";
import { codigoDeError, esEstadoInicial, vacioSinDatos } from "./estadoEsperado";

/**
 * **«Todavía no hay datos» no es «no se pudo cargar».**
 *
 * El backend responde 409 `E_NO_DATA_INST` cuando el proyecto aún no tiene base
 * ni instrumento, que es el estado normal de un estudio recién creado. Las tres
 * pestañas de Validación lo pintaban como avería. Visto en pantalla el
 * 2026-08-23 sobre un proyecto sin cargar:
 *
 *     No se pudo cargar el explorador
 *     No hay data o instrumento cargado para esta base. · E_NO_DATA_INST
 *
 * El criterio vive en un módulo y no en cada pestaña porque son tres: si cada
 * una decide por su cuenta cuándo un error es un estado, vuelven a divergir.
 */
describe("estadoEsperado", () => {
  it("reconoce el estado inicial y no cualquier error", () => {
    expect(esEstadoInicial("E_NO_DATA_INST")).toBe(true);
    expect(esEstadoInicial("E_INTERNAL")).toBe(false);
    expect(esEstadoInicial("")).toBe(false);
    expect(esEstadoInicial(null)).toBe(false);
  });

  it("saca el código de un ApiError y sólo de un ApiError", () => {
    expect(codigoDeError(new ApiError("E_NO_DATA_INST", "No hay data"))).toBe("E_NO_DATA_INST");
    // Un Error normal no tiene código: devolver "" es lo correcto, porque
    // adivinarlo del mensaje volvería a mezclar avería con estado.
    expect(codigoDeError(new Error("algo"))).toBe("");
    expect(codigoDeError(null)).toBe("");
  });

  it("el vacío nombra dónde se resuelve, no sólo qué falta", () => {
    const v = vacioSinDatos("que explorar");
    expect(v.title).toBe("Todavía no hay datos que explorar");
    // La salida, que es lo que un aviso tiene que dar.
    expect(v.hint).toContain("Procesamiento › Carga");
    // Y no arrastra el código técnico que el mensaje del error lleva pegado.
    expect(`${v.title} ${v.hint}`).not.toContain("E_NO_DATA_INST");
  });
});
