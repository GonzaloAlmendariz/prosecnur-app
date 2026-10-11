import { describe, expect, it } from "vitest";
import { enfocarSinDesplazar } from "./enfocarSinDesplazar";

describe("enfocarSinDesplazar (Avisos no corre el visor al enfocar; verificador frontend-3)", () => {
  it("enfoca con preventScroll", () => {
    const llamadas: Array<FocusOptions | undefined> = [];
    expect(enfocarSinDesplazar({ focus: (o) => llamadas.push(o) })).toBe(true);
    expect(llamadas).toEqual([{ preventScroll: true }]);
  });
  it("sin elemento no hace nada", () => {
    expect(enfocarSinDesplazar(null)).toBe(false);
    expect(enfocarSinDesplazar(undefined)).toBe(false);
  });
});
