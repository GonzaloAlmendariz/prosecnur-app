import { describe, expect, test } from "vitest";
import { argsQueAplican } from "./argDependencias";
import { normalizeGraficosRegistry, normalizePresetsRegistry } from "./metadataSanitizers";

describe("metadataSanitizers", () => {
  test("preserva el contrato conocido de puntos comparativos", () => {
    const [points] = normalizeGraficosRegistry({
      slides: [],
      graficadores: [{
        name: "p_puntos_comparativos",
        titulo_humano: "Puntos comparativos",
        icono_ui: "CircleDot",
        categoria: "comparison",
        blueprint: "comparison-dots",
        capability_key: "",
        authoring_mode: "direct",
        data_requirement: "var_cruces_corte",
        preset_key: "puntos_comparativos",
        args: [],
        args_extra: [],
      }],
    }).graficadores;

    expect(points).toMatchObject({
      categoria: "comparison",
      blueprint: "comparison-dots",
      authoring_mode: "direct",
      data_requirement: "var_cruces_corte",
      preset_key: "puntos_comparativos",
    });
  });

  test("falla cerrado ante categorías, roles y blueprints futuros sin perder el orden", () => {
    const registry = normalizeGraficosRegistry({
      slides: [
        {
          name: "p_slide_futuro",
          render_key: "  render_futuro  ",
          titulo_humano: { label: "Slide futuro" },
          descripcion: {},
          icono_ui: "Type",
          categoria: "experimental",
          blueprint: {
            kind: "immersive",
            ppt_layout: { label: "Layout futuro" },
            structure_label: {},
          },
          slot_specs: [
            { name: "grafico_futuro", role: "video", label: {} },
            { name: "grafico_futuro", role: "chart", label: "Duplicado" },
            {},
          ],
          slots: ["legacy", {}],
          args: [{
            name: "titulo",
            label: {},
            tipo_input: "inventado",
            grupo: "inventado",
            descripcion: { texto: "Título visible" },
          }],
          args_extra: [{}],
        },
        {
          name: "p_slide_texto",
          titulo_humano: "Texto",
          categoria: "estructural",
          slots: [],
          args: [],
          args_extra: [],
        },
      ],
      graficadores: [{
        name: "p_visual_futuro",
        titulo_humano: "Visual futuro",
        categoria: "immersive",
        blueprint: "hologram",
        args: [],
        args_extra: [],
      }],
    });

    expect(registry.slides.map((slide) => slide.name)).toEqual([
      "p_slide_futuro",
      "p_slide_texto",
    ]);
    expect(registry.slides[0]).toMatchObject({
      render_key: "render_futuro",
      categoria: "otro",
      blueprint: {
        kind: "neutral",
        ppt_layout: "Layout futuro",
        structure_label: "Composición compatible",
      },
      slots: ["legacy"],
      slot_specs: [{
        name: "grafico_futuro",
        role: "unknown",
        label: "Grafico futuro",
      }],
      args_extra: [],
    });
    expect(registry.slides[0].args[0]).toMatchObject({
      label: "titulo",
      tipo_input: "string",
      grupo: "diagnostico",
      descripcion: "Título visible",
    });
    expect(registry.graficadores[0]).toMatchObject({
      categoria: "other",
      blueprint: "future",
      available: true,
    });
  });

  test("distingue slot_specs ausente de presente-vacío para el fallback legacy", () => {
    const registry = normalizeGraficosRegistry({
      slides: [
        {
          name: "p_slide_1_grafico",
          titulo_humano: "Backend viejo",
          categoria: "1grafico",
          slots: ["grafico"],
          args: [],
          args_extra: [],
        },
        {
          name: "p_slide_sin_zonas",
          titulo_humano: "Backend nuevo vacío",
          categoria: "estructural",
          slot_specs: null,
          slots: ["legacy_no_debe_mandar"],
          args: [],
          args_extra: [],
        },
      ],
      graficadores: [],
    });

    expect(Object.hasOwn(registry.slides[0], "slot_specs")).toBe(false);
    expect(registry.slides[0].render_key).toBe("");
    expect(registry.slides[0].blueprint?.kind).toBe("neutral");
    expect(Object.hasOwn(registry.slides[1], "slot_specs")).toBe(true);
    expect(registry.slides[1].slot_specs).toEqual([]);
    expect(registry.slides[1].slots).toEqual(["legacy_no_debe_mandar"]);
  });

  test("convierte raíces malformadas en catálogos vacíos sin inventar defaults locales", () => {
    expect(normalizeGraficosRegistry(null)).toEqual({ slides: [], graficadores: [] });
    expect(normalizeGraficosRegistry({ slides: {}, graficadores: "fallo" })).toEqual({
      slides: [],
      graficadores: [],
    });
  });

  test("conserva depende para que argsQueAplican filtre el modo después de normalizar", () => {
    const registry = normalizeGraficosRegistry({
      slides: [],
      graficadores: [{
        name: "p_dependencias",
        titulo_humano: "Dependencias",
        descripcion: "Prueba causal",
        icono_ui: "BarChart",
        categoria: "other",
        blueprint: "future",
        args: [
          {
            name: "modo",
            label: "Modo",
            tipo_input: "choice",
            grupo: "datos",
          },
          {
            name: "variable_sm",
            label: "Variable para SM",
            tipo_input: "variable",
            grupo: "datos",
            descripcion: "Sólo aplica a SM",
            unidad: "%",
            min: 0,
            max: 100,
            step: 5,
            control: "slider",
            relacionados: ["modo"],
            efecto: "Cambia la selección",
            choices: [{ value: "uno", label: "Uno", hint: "Primero" }],
            opciones: [{ value: "dos", label: "Dos" }],
            default: false,
            depende: { arg: "modo", valores: ["sm"] },
          },
        ],
        args_extra: [],
      }],
    });
    const args = registry.graficadores[0].args;

    expect(args[1]).toMatchObject({
      descripcion: "Sólo aplica a SM",
      unidad: "%",
      min: 0,
      max: 100,
      step: 5,
      control: "slider",
      relacionados: ["modo"],
      efecto: "Cambia la selección",
      choices: [{ value: "uno", label: "Uno", hint: "Primero" }],
      opciones: [{ value: "dos", label: "Dos" }],
      default: false,
      depende: { arg: "modo", valores: ["sm"] },
    });
    expect(argsQueAplican(args, { modo: "publicos" }).map((arg) => arg.name)).toEqual(["modo"]);
    expect(argsQueAplican(args, { modo: "sm" }).map((arg) => arg.name)).toEqual([
      "modo",
      "variable_sm",
    ]);
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
    });

    expect(registry.presets[0].titulo_humano).toBe("base");
    expect(registry.presets[0].descripcion).toBe("Preset base");
    expect(registry.presets[0].icono_ui).toBe("Sliders");
  });
});
