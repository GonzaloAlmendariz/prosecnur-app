import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";
import type { PresetMetadata } from "../../../api/graficos";
import { usePlanStore, type GraficosConfig } from "../store";
import { MOTIVO_WORD_EN_COMPARTIDO } from "./disponibilidadInforme";

// Pestaña «Estilo del informe»: lo que el markup promete (C1, un solo dueño de desplazamiento, readiness, sellos,
// candado del Word y disponibilidad en el compartido) sin levantar la pila. Los catálogos se fijan con mocks.

vi.mock("zustand", async (importOriginal) => {
  const real = await importOriginal<typeof import("zustand")>();
  const create = <T,>(init: StateCreator<T, [], []>) => {
    const api = real.createStore<T>()(init);
    api.getInitialState = api.getState;
    return Object.assign(<U,>(selector: (s: T) => U) => real.useStore(api, selector), api);
  };
  return { ...real, create };
});

const CATALOGO: PresetMetadata[] = [
  {
    name: "base", titulo_humano: "Base", descripcion: "", icono_ui: "Layers",
    args: [
      { name: "formato", label: "Formato", tipo_input: "string", grupo: "textos", default: "Base: %s" },
      { name: "sufijo_auto", label: "Sufijo", tipo_input: "string", grupo: "textos" },
      { name: "nota_redondeo", label: "Nota", tipo_input: "bool", grupo: "valores", default: false },
    ],
  },
  {
    name: "barras_apiladas", titulo_humano: "Barras apiladas", descripcion: "", icono_ui: "BarChart",
    args: [
      { name: "metodo_redondeo", label: "Método", tipo_input: "choice", grupo: "valores", default: "estandar", choices: [{ value: "estandar", label: "Redondeo estándar" }, { value: "reparto", label: "Reparto a 100 %" }] },
      { name: "decimales", label: "Decimales", tipo_input: "number", grupo: "valores", default: 0 },
    ],
    calculos: { familia_porcentaje: true, cierra_100: true, admite_metodo: true, campo_decimales: "decimales" },
    word_fijado: [{ arg: "size_leyenda", valor: 8, unidad: "pt", motivo: "Lo fija el recetario en el Word: leyenda de 8 pt.", aplica_si_marco: true }],
  },
];

const estadoCatalogo = { loading: false, error: "" };
const estadoDefaults = { loading: false };

vi.mock("../usePresetsMetadata", () => ({
  usePresetsMetadata: () => ({
    presets: CATALOGO,
    presetsByName: Object.fromEntries(CATALOGO.map((p) => [p.name, p])),
    loading: estadoCatalogo.loading,
    error: estadoCatalogo.error,
  }),
}));
vi.mock("../usePresetsDefaults", () => ({
  usePresetsDefaults: () => ({ presets: { base: { formato: "Base: %s", sufijo_auto: "respuestas" } }, esCustom: false, loading: estadoDefaults.loading, error: "", refresh: async () => undefined }),
}));
vi.mock("../usePptStyleProfiles", () => ({
  usePptStyleProfiles: () => ({
    profiles: [{ name: "acnur", titulo_humano: "ACNUR", descripcion: "Línea ACNUR", icono_ui: "Palette", preview_colors: ["#0072BC"], presets: {} }],
    loading: false,
    error: "",
  }),
}));
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
const { default: PestanaEstiloInforme } = await import("./PestanaEstiloInforme");

function pintar(search = "?pestana=estilo-informe") {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [`/graficos${search}`] }, createElement(PestanaEstiloInforme)));
}

beforeEach(() => {
  estadoCatalogo.loading = false;
  estadoCatalogo.error = "";
  estadoDefaults.loading = false;
  usePlanStore.getState().hydrate({
    version: "graficos/4", plan: { slides: [] },
    presets: { base: { sufijo_auto: "docentes" }, barras_apiladas: { metodo_redondeo: "reparto" } },
    w_presets: { chart_options: { ocultar_etiqueta_si_titulo: true }, chart_presets: {} },
    selected_slide_id: null, paletas: { lst_a: { Sí: "#0072BC" } }, iconos: [], overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    scope_rules: { global: { profile_id: "acnur" } },
  } as GraficosConfig);
});

describe("PestanaEstiloInforme · markup", () => {
  it("declara su superficie, su grupo de secciones y un solo dueño de desplazamiento", () => {
    const html = pintar();
    expect(html).toContain('data-audit-ready="graficos-estilo-informe"');
    expect(html).toContain('data-qa-surface="graficos/f6-estilo-informe"');
    expect(html.match(/data-qa-scroll-owner=/g)).toHaveLength(1);
    for (const grupo of ["f6-estilo-informe-secciones", "f6-estilo-informe-texto-base"]) {
      expect(html).toContain(`data-qa-geometry-group="graficos/${grupo}"`);
    }
    // Cuatro secciones: texto de la base, cálculos, línea visual y paletas (el Word tiene su pestaña).
    expect(html.match(/class="pulso-f6-informe-seccion"/g)).toHaveLength(4);
  });

  it("mientras carga el catálogo o los defaults, la readiness queda en false", () => {
    estadoDefaults.loading = true;
    expect(pintar()).toContain('data-audit-ready="false"');
    estadoDefaults.loading = false;
    estadoCatalogo.loading = true;
    const html = pintar();
    expect(html).toContain('data-audit-ready="false"');
    // El vacío vive en su sección (C3): la tabla de cálculos cede su lugar a un estado.
    expect(html).toContain("Cargando…");
  });

  it("sellos «Propio» donde hay decisión y «Del recetario» en lo demás", () => {
    const html = pintar();
    // Sufijo propio, método de apiladas propio, línea visual aplicada, paletas con color.
    expect(html.match(/pulso-f6-estilo-sello is-propio/g)).toHaveLength(4);
    expect(html).toContain("Por defecto");
    expect(html).toContain("Base: 120 docentes");
    expect(html).toContain('aria-label="Volver al valor por defecto en sufijo del conteo"');
    expect(html).toContain('aria-label="Volver al valor por defecto en Barras apiladas"');
    expect(html).toContain("1 lista con colores propios");
  });


  it("en el informe compartido sigue habilitada", () => {
    const html = pintar("?pestana=estilo-informe&scope=consolidado");
    expect(html).toContain('data-scope="consolidated"');
    expect(html).toContain("cambian su PPT consolidado y no se copian a ninguna base");
    expect(html).not.toMatch(/<input[^>]*type="checkbox"[^>]*disabled=""/);
    expect(html).toMatch(/<select id="f6-informe-met-barras_apiladas"(?![^>]*disabled)/);
    expect(html).toContain("Aplicar a todos");
  });
});
