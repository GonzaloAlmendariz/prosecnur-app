import { describe, it, expect } from "vitest";
import { grupoHue, grupoAccentColor } from "./codificacionGrupoColor";

describe("codificacionGrupoColor", () => {
  it("da hues estables para el mismo código", () => {
    expect(grupoHue("3", "x")).toBe(grupoHue("3", "y"));
  });

  it("separa códigos numéricos contiguos (ángulo áureo)", () => {
    const h1 = grupoHue("1", "");
    const h2 = grupoHue("2", "");
    const h3 = grupoHue("3", "");
    // Contiguos no deben colapsar en el mismo matiz.
    expect(h1).not.toBe(h2);
    expect(h2).not.toBe(h3);
    // Separación mínima razonable entre categorías contiguas.
    const sep = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
    expect(sep).toBeGreaterThan(60);
  });

  it("cae al hash del texto para códigos no numéricos", () => {
    const a = grupoHue("otros", "seed");
    const b = grupoHue("otros", "seed");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
  });

  it("usa el fallback cuando el código está vacío", () => {
    expect(grupoHue("", "g_123")).toBe(grupoHue("", "g_123"));
    expect(grupoHue("  ", "g_abc")).toBeGreaterThanOrEqual(0);
  });

  it("produce un color hsl válido", () => {
    expect(grupoAccentColor("5", "")).toMatch(/^hsl\(\d+, 62%, 45%\)$/);
  });
});
