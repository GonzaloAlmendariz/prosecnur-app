import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { guardarPlegado, leerPlegado } from "./plegadoRecordado";

/** Almacenamiento en memoria: el entorno de Vitest de este repo no trae `localStorage`. */
function almacenEnMemoria(): Pick<Storage, "getItem" | "setItem"> {
  const datos = new Map<string, string>();
  return {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => { datos.set(k, v); },
  };
}

describe("plegadoRecordado", () => {
  beforeEach(() => vi.stubGlobal("localStorage", almacenEnMemoria()));
  afterEach(() => vi.unstubAllGlobals());

  test("sin preferencia guardada devuelve el valor por defecto", () => {
    expect(leerPlegado("ayuda-x", true)).toBe(true);
    expect(leerPlegado("ayuda-x", false)).toBe(false);
  });

  test("recuerda lo que eligió el usuario", () => {
    guardarPlegado("ayuda-y", false);
    expect(leerPlegado("ayuda-y", true)).toBe(false);
    guardarPlegado("ayuda-y", true);
    expect(leerPlegado("ayuda-y", false)).toBe(true);
  });

  test("si el almacenamiento falla, no rompe y usa el valor por defecto", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("bloqueado"); },
      setItem: () => { throw new Error("cuota"); },
    });
    expect(() => guardarPlegado("ayuda-z", true)).not.toThrow();
    expect(leerPlegado("ayuda-z", false)).toBe(false);
  });

  test("sin almacenamiento disponible usa el valor por defecto", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => guardarPlegado("ayuda-w", true)).not.toThrow();
    expect(leerPlegado("ayuda-w", true)).toBe(true);
  });
});
