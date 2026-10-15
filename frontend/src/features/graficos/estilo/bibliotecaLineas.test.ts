// ID3b (2026-10-15). Mata: una tarjeta que no dice qué trae la línea, o que confunde «sin ajustes» con un número.
import { describe, expect, it } from "vitest";
import { queTrae } from "./BibliotecaLineas";

describe("biblioteca de líneas visuales", () => {
  it("dice qué trae una línea en palabras", () => {
    expect(queTrae({ presets: { base: {}, barras: {} }, paletas: { sino: {} }, overrides_reusables: [] })).toBe("2 bases de gráfico, 1 paleta");
    expect(queTrae({ presets: {}, paletas: {}, overrides_reusables: [{ id: "x" } as never] })).toBe("1 estilo guardado");
    expect(queTrae({ presets: {}, paletas: {}, overrides_reusables: [] })).toBe("Sin ajustes");
  });
});
