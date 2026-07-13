import { describe, expect, test } from "vitest";
import { paletteForType, paletteSoftForType } from "./paletteForType";

// El grupo repetible (begin_repeat / end_repeat) es de primera clase: su color
// es SIEMPRE el token naranja transversal `--pulso-repeat-*`, no un hex de la
// paleta categórica. Esto mantiene la identidad consistente entre Carga, el
// editor y el mapa de lógica.
describe("paletteForType — identidad naranja del repeat", () => {
  test("begin_repeat / end_repeat devuelven el acento naranja del token", () => {
    expect(paletteForType("begin_repeat")).toBe("var(--pulso-repeat-accent)");
    expect(paletteForType("end_repeat")).toBe("var(--pulso-repeat-accent)");
  });

  test("el soft del repeat es el fondo naranja del token (no el neutro)", () => {
    expect(paletteSoftForType("begin_repeat")).toBe("var(--pulso-repeat-bg)");
    expect(paletteSoftForType("end_repeat")).toBe("var(--pulso-repeat-bg)");
  });

  test("un grupo normal (begin_group) NO usa la identidad repeat", () => {
    expect(paletteForType("begin_group")).not.toBe("var(--pulso-repeat-accent)");
    expect(paletteSoftForType("begin_group")).not.toBe("var(--pulso-repeat-bg)");
  });

  test("tipos con hex siguen produciendo un soft rgba válido", () => {
    // select_one es un hex de la paleta → soft es rgba, no un token.
    expect(paletteSoftForType("select_one")).toMatch(/^rgba\(/);
  });
});
