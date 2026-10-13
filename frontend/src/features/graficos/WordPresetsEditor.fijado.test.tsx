import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PresetMetadata } from "../../api/graficos";
import { createDefaultWordPresets } from "../../api/graficosConfigNormalizer";
import { LineaFijadaRecetario } from "./LineaFijadaRecetario";
import { WordPresetsEditor } from "./WordPresetsEditor";

const MOTIVO_LEYENDA = "Lo fija el recetario en el Word: la leyenda va a 8 pt. Si el gráfico cae al marco, este ajuste sí aplica.";
const MOTIVO_NEGRITA = "Lo fija el recetario en el Word: las cifras y los rótulos van siempre en negrita.";

const PRESET: PresetMetadata = {
  name: "barras_apiladas",
  titulo_humano: "Barras apiladas",
  descripcion: "",
  icono_ui: "Sliders",
  args: [
    { name: "size_leyenda", label: "Tamaño de la leyenda", tipo_input: "number", grupo: "leyenda", unidad: "pt", default: 8 },
    { name: "decimales", label: "Decimales", tipo_input: "number", grupo: "valores", default: 0 },
  ],
  word_fijado: [
    { arg: "size_leyenda", valor: 8, unidad: "pt", motivo: MOTIVO_LEYENDA, aplica_si_marco: true },
    { arg: "textos_negrita", motivo: MOTIVO_NEGRITA, aplica_si_marco: true },
  ],
};

vi.mock("./usePresetsMetadata", () => ({
  usePresetsMetadata: () => ({ presets: [PRESET], presetsByName: { [PRESET.name]: PRESET }, loading: false, error: "" }),
}));

// renderToStaticMarkup lee el estado inicial de zustand (snapshot de servidor), no el de setState: se sustituye el hook
// por un selector sobre un estado de prueba.
type EstadoPrueba = {
  presets: Record<string, Record<string, unknown>>;
  wPresets: Record<string, Record<string, unknown>>;
  setWPresets: (w: Record<string, Record<string, unknown>>) => void;
  configDefaults: null;
};
const estado = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("./store", () => ({
  usePlanStore: <T,>(sel: (s: EstadoPrueba) => T): T => sel(estado.actual as EstadoPrueba),
}));

function conDecisiones(chart: Record<string, unknown>) {
  const w = createDefaultWordPresets();
  const presets = (w.chart_presets ?? {}) as Record<string, Record<string, unknown>>;
  const siguiente: EstadoPrueba = {
    presets: {},
    wPresets: { ...w, chart_presets: { ...presets, barras_apiladas: { ...(presets.barras_apiladas ?? {}), ...chart } } },
    setWPresets: () => undefined,
    configDefaults: null,
  };
  estado.actual = siguiente;
}

function wPresetsActuales(): Record<string, Record<string, unknown>> {
  return (estado.actual as EstadoPrueba).wPresets;
}

function bloqueDe(html: string, arg: string): string {
  const i = html.indexOf(`data-arg-name="${arg}"`);
  expect(i).toBeGreaterThan(-1);
  const inicio = html.lastIndexOf("<div", i);
  const fin = html.indexOf('data-arg-name="', i + 20);
  return html.slice(inicio, fin === -1 ? undefined : fin);
}

describe("WordPresetsEditor con word_fijado", () => {
  beforeEach(() => conDecisiones({}));

  test("el motivo es la descripción enlazada (aria-describedby)", () => {
    const html = renderToStaticMarkup(createElement(LineaFijadaRecetario, {
      fijado: PRESET.word_fijado![0], meta: PRESET.args[0],
    }));
    const describedby = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedby).toBeTruthy();
    expect(html).toContain(`id="${describedby}"`);
    expect(html).toMatch(new RegExp(`id="${describedby}"[^>]*>${MOTIVO_LEYENDA.slice(0, 30)}`));
    expect(html).toMatch(/role="group"/);
  });

  test("una decisión en un arg que sí manda sigue contando como Modificado", () => {
    conDecisiones({ decimales: 2 });
    const html = renderToStaticMarkup(createElement(WordPresetsEditor));
    expect(html).toContain("1 ajuste propio");   // G15 (2026-10-13): antes «1 ajuste Word»
    expect(html).toContain("Volver a heredar PPT");
  });
});
