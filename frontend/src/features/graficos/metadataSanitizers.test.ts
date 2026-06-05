import { describe, expect, test } from "vitest";
import { normalizeGraficosRegistry, normalizePresetsRegistry } from "./metadataSanitizers";

describe("metadataSanitizers", () => {
  test("normaliza textos del registry antes de renderizar", () => {
    const registry = normalizeGraficosRegistry({
      slides: [{
        name: "p_slide_texto",
        titulo_humano: { label: "Slide texto" },
        descripcion: {},
        icono_ui: "Type",
        categoria: "estructural",
        slots: ["texto", {}],
        args: [{
          name: "titulo",
          label: {},
          tipo_input: "string",
          grupo: "textos",
          descripcion: { texto: "Titulo visible" },
        }],
        args_extra: [{}],
      }],
      graficadores: [],
    } as never);

    expect(registry.slides[0].titulo_humano).toBe("Slide texto");
    expect(registry.slides[0].descripcion).toBe("");
    expect(registry.slides[0].slots).toEqual(["texto"]);
    expect(registry.slides[0].args[0].label).toBe("titulo");
    expect(registry.slides[0].args[0].descripcion).toBe("Titulo visible");
    expect(registry.slides[0].args_extra).toEqual([]);
  });

  test("normaliza metadata de presets", () => {
    const registry = normalizePresetsRegistry({
      presets: [{
        name: "base",
        titulo_humano: {},
        descripcion: { label: "Preset base" },
        icono_ui: {},
        args: [],
      }],
    } as never);

    expect(registry.presets[0].titulo_humano).toBe("base");
    expect(registry.presets[0].descripcion).toBe("Preset base");
    expect(registry.presets[0].icono_ui).toBe("Sliders");
  });
});
