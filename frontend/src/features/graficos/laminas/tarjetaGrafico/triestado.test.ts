import { describe, expect, it } from "vitest";
import { claveTriestado, OPCIONES_TRIESTADO, valorTriestado } from "./triestado";

describe("interruptor de tres estados («N en la leyenda»)", () => {
  it("sin valor guardado se ve Automático; true es Sí y false es No", () => {
    expect(claveTriestado(undefined)).toBe("auto");
    expect(claveTriestado(null)).toBe("auto");
    expect(claveTriestado(true)).toBe("si");
    expect(claveTriestado(false)).toBe("no");
  });
  it("Automático guarda null: el motor decide (con tres o cuatro grupos va el n)", () => {
    expect(valorTriestado("auto")).toBeNull();
    expect(valorTriestado("si")).toBe(true);
    expect(valorTriestado("no")).toBe(false);
  });
  it("las tres opciones, en ese orden", () => {
    expect(OPCIONES_TRIESTADO.map((o) => o.label)).toEqual(["Automático", "Sí", "No"]);
  });
});
