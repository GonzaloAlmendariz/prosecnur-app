import { describe, expect, test } from "vitest";
import {
  aplicarOrdenGuardado,
  enviarEspecialesAlFinal,
  esValorEspecial,
  ordenesIguales,
  sembrarOrden,
  VALORES_ESPECIALES,
} from "./ordenCategoriasModel";

describe("ordenCategoriasModel", () => {
  test("esValorEspecial reconoce el estándar de la casa", () => {
    for (const code of VALORES_ESPECIALES) expect(esValorEspecial(code)).toBe(true);
    expect(esValorEspecial("1")).toBe(false);
    expect(esValorEspecial("5")).toBe(false);
  });

  test("enviarEspecialesAlFinal empuja especiales al final preservando orden relativo", () => {
    expect(enviarEspecialesAlFinal(["1", "98", "2", "99", "3"])).toEqual(["1", "2", "3", "98", "99"]);
  });

  test("enviarEspecialesAlFinal no altera listas sin especiales", () => {
    expect(enviarEspecialesAlFinal(["1", "2", "3"])).toEqual(["1", "2", "3"]);
  });

  test("aplicarOrdenGuardado respeta guardados y anexa faltantes en orden del instrumento", () => {
    const instrumento = ["1", "2", "3", "4"];
    const guardado = ["3", "1"];
    expect(aplicarOrdenGuardado(instrumento, guardado)).toEqual(["3", "1", "2", "4"]);
  });

  test("aplicarOrdenGuardado descarta códigos guardados que ya no existen y no duplica", () => {
    const instrumento = ["1", "2", "3"];
    const guardado = ["3", "999", "3", "2"];
    expect(aplicarOrdenGuardado(instrumento, guardado)).toEqual(["3", "2", "1"]);
  });

  test("sembrarOrden sin override usa instrumento con especiales al final", () => {
    expect(sembrarOrden(["1", "98", "2", "99"], undefined)).toEqual(["1", "2", "98", "99"]);
    expect(sembrarOrden(["1", "2"], [])).toEqual(["1", "2"]);
  });

  test("sembrarOrden con override lo respeta tal cual (ausentes al final)", () => {
    expect(sembrarOrden(["1", "2", "3", "99"], ["99", "1"])).toEqual(["99", "1", "2", "3"]);
  });

  test("ordenesIguales compara secuencia exacta", () => {
    expect(ordenesIguales(["1", "2"], ["1", "2"])).toBe(true);
    expect(ordenesIguales(["1", "2"], ["2", "1"])).toBe(false);
    expect(ordenesIguales(["1"], ["1", "2"])).toBe(false);
  });
});
