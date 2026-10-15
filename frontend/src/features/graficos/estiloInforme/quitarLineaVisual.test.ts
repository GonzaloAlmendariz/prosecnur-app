// L4 del rediseño (2026-10-14): «Quitar línea» resta lo que la línea trajo y respeta lo cambiado después.
import { describe, expect, it } from "vitest";
import type { PptStyleProfileMeta } from "../../../api/graficos";
import { sinEstiloDePerfil } from "./quitarLineaVisual";
import { lineaVisualAplicada } from "./modeloEstiloInforme";

const perfil = {
  name: "acnur", titulo_humano: "ACNUR", descripcion: "", icono_ui: "Palette", preview_colors: [],
  presets: { base: { size_titulo: 20, color_texto: "#111" }, barras: { grosor: 0.6 } },
  paletas: { sino: { "Sí": "#00f", "No": "#f00" } },
  overrides_reusables: [{ id: "compacto", nombre: "compacto", tipo_preset: "barras", args: { a: 1 } }],
  scope_rules: { global: { profile_id: "acnur", template_id: "acnur_16_9" } },
} as unknown as PptStyleProfileMeta;

describe("Quitar línea visual", () => {
  // Mata: un quitar que deja el profile_id (la sección seguiría diciendo «aplicada»), que borra lo del usuario o que
  // no borra lo de la línea.
  it("borra lo que sigue siendo de la línea y conserva lo que se cambió después o no venía de ella", () => {
    const estado = {
      presets: { base: { size_titulo: 20, color_texto: "#222", propio: true }, barras: { grosor: 0.6 } },
      paletas: { sino: { "Sí": "#00f", "No": "#0a0" }, otra: { A: "#ccc" } },
      overridesReusables: [
        { id: "compacto", nombre: "compacto", tipo_preset: "barras", args: { a: 1 } },
        { id: "mio", nombre: "mio", tipo_preset: "pie", args: {} },
      ],
      scopeRules: { global: { profile_id: "acnur", template_id: "acnur_16_9", auto_otros_slides: true } },
    };
    const r = sinEstiloDePerfil(estado, perfil);
    expect(r.presets).toEqual({ base: { color_texto: "#222", propio: true } });
    expect(r.paletas).toEqual({ sino: { "No": "#0a0" }, otra: { A: "#ccc" } });
    expect(r.overridesReusables.map((o) => o.id)).toEqual(["mio"]);
    expect(r.scopeRules).toEqual({ global: { auto_otros_slides: true } });
    expect(lineaVisualAplicada(r.scopeRules)).toBeNull();
  });

  it("un ajuste guardado con el mismo id pero editado ya no es de la línea y se queda", () => {
    const estado = {
      presets: {}, paletas: {}, scopeRules: {},
      overridesReusables: [{ id: "compacto", nombre: "compacto", tipo_preset: "barras", args: { a: 2 } }],
    };
    expect(sinEstiloDePerfil(estado, perfil).overridesReusables).toHaveLength(1);
  });
});
