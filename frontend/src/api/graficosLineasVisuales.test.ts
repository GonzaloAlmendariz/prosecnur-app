// ID3 (2026-10-15). Mata: un normalizador que deja pasar los `[x]` de Plumber (el aplicar fundiría arreglos en vez de
// valores), que acepta una línea sin id válido, o un id nuevo con tildes/espacios que el servidor rechaza.
import { describe, expect, it } from "vitest";
import { idLineaNueva, normalizarLineaVisual } from "./graficosLineasVisuales";

describe("líneas visuales propias", () => {
  it("desenvuelve los escalares de Plumber y completa lo que falta", () => {
    const l = normalizarLineaVisual({
      id: ["lv-azul-abc123"], titulo_humano: ["Azul"], preview_colors: [["#003366"], ["nope"]],
      presets: { base: { size_titulo: [20] } }, paletas: { sino: { "Sí": ["#003366"] } },
      scope_rules: { global: { profile_id: ["lv-azul-abc123"] } }, incluye: { portada: [false] }, origen: ["propia"],
    });
    expect(l?.titulo_humano).toBe("Azul");
    expect(l?.name).toBe("lv-azul-abc123");
    expect(l?.preview_colors).toEqual(["#003366"]);
    expect(l?.presets).toEqual({ base: { size_titulo: 20 } });
    expect(l?.paletas).toEqual({ sino: { "Sí": "#003366" } });
    expect(l?.scope_rules).toEqual({ global: { profile_id: "lv-azul-abc123" } });
    expect(l?.incluye).toEqual({ colores: true, portada: false, letra: true, logos: true });
  });

  it("descarta lo que no tiene id de línea", () => {
    expect(normalizarLineaVisual({ id: "acnur_kobo" })).toBeNull();
    expect(normalizarLineaVisual(null)).toBeNull();
  });

  it("el id nuevo sale del nombre, sin tildes ni espacios, con un sufijo", () => {
    expect(idLineaNueva("Acreditación  Ñuñoa 2026", () => "x1y2z3")).toBe("lv-acreditacion-nunoa-2026-x1y2z3");
    expect(idLineaNueva("¿?", () => "abcd12")).toBe("lv-linea-abcd12");
  });
});
