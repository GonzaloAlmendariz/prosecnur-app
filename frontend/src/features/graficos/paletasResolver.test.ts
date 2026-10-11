import { describe, expect, it, beforeEach } from "vitest";
import { normalizeGraficosConfig } from "../../api/graficosConfigNormalizer";
import {
  clavesHuerfanas,
  coloresPorEtiqueta,
  conVinculo,
  firmaOpciones,
  listasQueUsan,
  normalizarEtiquetaPaleta,
  resolverPaleta,
  vinculosDecisiones,
} from "./paletasResolver";
import { listasConColor } from "./estiloInforme/modeloEstiloInforme";
import { buildGraficosConfig, graficosConfigFromRemote } from "./configSnapshot";
import { componerImportacion, pickGraficosConfigSections, todasLasSecciones } from "./compartir/seccionesJson";
import { usePlanStore, type GraficosConfig } from "./store";

// ADR 0097 (capa frontend): el editor de Paletas dice de dónde toma sus colores cada lista con el MISMO orden que el
// motor —nombre (± s/es) → vínculo → firma de opciones—, muestra las paletas sin lista del instrumento y guarda los
// vínculos sólo como decisiones, por el autosave y por el JSON por secciones.

const lista = (list_name: string, labels: string[]) => ({ list_name, choices: labels.map((label) => ({ name: label, label })) });

const ACUERDO = ["Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"];
const PALETA_ACUERDO = {
  "Totalmente en desacuerdo": "#F4B183",
  "En desacuerdo": "#FFD965",
  "De acuerdo": "#ADD493",
  "Totalmente de acuerdo": "#70AD47",
};

describe("normalización y firma de opciones", () => {
  it("quita caja, tildes y espacios repetidos", () => {
    expect(normalizarEtiquetaPaleta("  Totalmente   en DESACUERDO ")).toBe("totalmente en desacuerdo");
    expect(normalizarEtiquetaPaleta("Sí")).toBe(normalizarEtiquetaPaleta("si"));
  });

  it("la firma es un conjunto: el orden y la caja no la cambian; otra opción sí", () => {
    expect(firmaOpciones(["Sí", "No"])).toBe(firmaOpciones(["no", "SI"]));
    expect(firmaOpciones(["Sí", "No"])).not.toBe(firmaOpciones(["Sí", "No", "No sabe"]));
  });
});

describe("resolverPaleta: nombre → vínculo → firma", () => {
  it("nombre exacto y ± s/es, como `.paleta_auto`", () => {
    expect(resolverPaleta(lista("lst_p14", ACUERDO), { lst_p14: PALETA_ACUERDO })).toEqual({ origen: "propia", clave: "lst_p14" });
    expect(resolverPaleta(lista("opcion", ["A"]), { opciones: { A: "#111111" } })).toEqual({ origen: "propia", clave: "opciones" });
  });

  it("el vínculo gana a la firma y pierde ante el nombre", () => {
    const paletas = { acuerdo_4: PALETA_ACUERDO, otra: { ...PALETA_ACUERDO } };
    expect(resolverPaleta(lista("lst_p14", ACUERDO), paletas, { lst_p14: "otra" })).toEqual({ origen: "vinculo", clave: "otra" });
    expect(resolverPaleta(lista("lst_p14", ACUERDO), { ...paletas, lst_p14: { "De acuerdo": "#000000" } }, { lst_p14: "otra" }))
      .toEqual({ origen: "propia", clave: "lst_p14" });
  });

  it("firma: misma lista de opciones con otra caja y orden toma la paleta de un perfil", () => {
    const opciones = ["totalmente de acuerdo", "DE ACUERDO", "En  desacuerdo", "Totalmente en desacuerdo"];
    expect(resolverPaleta(lista("lst_p14", opciones), { acuerdo_4: PALETA_ACUERDO })).toEqual({ origen: "firma", clave: "acuerdo_4" });
  });

  it("sin coincidencia no hay paleta; un vínculo a una clave sin colores no cuenta", () => {
    expect(resolverPaleta(lista("lst_p14", ["Sí", "No"]), { acuerdo_4: PALETA_ACUERDO })).toBeNull();
    expect(resolverPaleta(lista("lst_p14", ["Sí", "No"]), { vacia: { Sí: "" } }, { lst_p14: "vacia" })).toBeNull();
  });
});

describe("huérfanas: paletas sin lista en este instrumento", () => {
  it("son las claves con color que ninguna lista usa por su nombre", () => {
    const paletas = { lst_p14: PALETA_ACUERDO, acuerdo_4: PALETA_ACUERDO, likert: { A: "#111111" }, yesno: {}, lst_p15s: { X: "#222222" } };
    expect(clavesHuerfanas(paletas, ["lst_p14", "lst_p15"])).toEqual(["acuerdo_4", "likert"]);
  });

  it("listasQueUsan dice qué listas toman una huérfana y por qué camino", () => {
    const listas = [lista("lst_p14", ACUERDO), lista("lst_p20", ["Sí", "No"])];
    const usos = listasQueUsan("acuerdo_4", listas, { acuerdo_4: PALETA_ACUERDO }, { lst_p20: "acuerdo_4" });
    expect(usos.map((u) => [u.lista.list_name, u.origen])).toEqual([["lst_p14", "firma"], ["lst_p20", "vinculo"]]);
  });
});

describe("vínculos: sólo decisiones", () => {
  it("vinculosDecisiones descarta lo que no es una decisión", () => {
    expect(vinculosDecisiones({ lst_a: "acuerdo_4", lst_b: "", lst_c: "lst_c", lst_d: 3, " ": "x" })).toEqual({ lst_a: "acuerdo_4" });
    expect(vinculosDecisiones([])).toEqual({});
  });

  it("conVinculo pone, quita y no cambia nada si ya está", () => {
    const v = conVinculo({}, "lst_a", "acuerdo_4");
    expect(v).toEqual({ lst_a: "acuerdo_4" });
    expect(conVinculo(v, "lst_a", "acuerdo_4")).toBe(v);
    expect(conVinculo(v, "lst_a", null)).toEqual({});
    expect(Object.keys(conVinculo(v, "lst_a", null))).not.toContain("lst_a");
  });
});

describe("agrupar por firma: el color viaja por etiqueta, no por posición", () => {
  it("dos listas con las mismas opciones en otro orden reciben el mismo color por opción", () => {
    const destino = lista("lst_b", ["totalmente de acuerdo", "De acuerdo", "En desacuerdo", "Totalmente en desacuerdo"]);
    const out = Object.fromEntries(coloresPorEtiqueta(PALETA_ACUERDO, destino.choices).map((x) => [x.label, x.color]));
    expect(out["totalmente de acuerdo"]).toBe("#70AD47");
    expect(out["Totalmente en desacuerdo"]).toBe("#F4B183");
  });
});

describe("listasConColor no cuenta huérfanas (C51)", () => {
  const paletas = { lst_p14: PALETA_ACUERDO, acuerdo_4: PALETA_ACUERDO, likert: { A: "#111111" } };

  it("con las listas del instrumento: propias y vínculos, nunca huérfanas", () => {
    expect(listasConColor(paletas, ["lst_p14", "lst_p20"])).toBe(1);
    expect(listasConColor(paletas, ["lst_p14", "lst_p20"], { lst_p20: "likert" })).toBe(2);
    expect(listasConColor({ acuerdo_4: PALETA_ACUERDO }, ["lst_p14"])).toBe(0);
  });

  it("sin el instrumento todavía, cae al conteo por clave", () => {
    expect(listasConColor(paletas)).toBe(3);
  });
});

describe("la clave viaja: normalizador, productor único, JSON por secciones", () => {
  it("el normalizador la deja siempre presente y sólo con decisiones", () => {
    expect(normalizeGraficosConfig({}).paletas_vinculos).toEqual({});
    expect(normalizeGraficosConfig({ paletasVinculos: { lst_a: "acuerdo_4", lst_b: "lst_b" } }).paletas_vinculos)
      .toEqual({ lst_a: "acuerdo_4" });
    expect(normalizeGraficosConfig({ paletas_vinculos: { lst_a: "x" } })._unknown).toBeUndefined();
  });

  it("ida y vuelta por la config remota", () => {
    const cfg = graficosConfigFromRemote({ paletas: { acuerdo_4: PALETA_ACUERDO }, paletas_vinculos: { lst_a: "acuerdo_4" } });
    expect(cfg.paletas_vinculos).toEqual({ lst_a: "acuerdo_4" });
  });

  it("el JSON por secciones lleva los vínculos dentro de Colores y los combina al importar", () => {
    const cfg = normalizeGraficosConfig({ paletas: { acuerdo_4: PALETA_ACUERDO }, paletas_vinculos: { lst_a: "acuerdo_4" } });
    const soloPaletas = { ...todasLasSecciones(false), paletas: true };
    expect(pickGraficosConfigSections(cfg, soloPaletas, "replace").paletas_vinculos).toEqual({ lst_a: "acuerdo_4" });
    expect(pickGraficosConfigSections(cfg, { ...todasLasSecciones(false), plan: true }, "replace")).not.toHaveProperty("paletas_vinculos");

    const actual = normalizeGraficosConfig({ paletas_vinculos: { lst_b: "likert" } });
    const comb = componerImportacion(actual, cfg, soloPaletas, "merge");
    expect(comb.paletas_vinculos).toEqual({ lst_b: "likert", lst_a: "acuerdo_4" });
    const reem = componerImportacion(actual, cfg, soloPaletas, "replace");
    expect(reem.paletas_vinculos).toEqual({ lst_a: "acuerdo_4" });
  });
});

describe("store: setPaletaVinculo es un paso deshacible y llega al autosave", () => {
  beforeEach(() => {
    usePlanStore.getState().hydrate(normalizeGraficosConfig({}) as GraficosConfig);
  });

  it("vincular, deshacer, rehacer y quitar", () => {
    const s = usePlanStore.getState();
    s.setPaletaVinculo("lst_p14", "acuerdo_4");
    expect(usePlanStore.getState().paletasVinculos).toEqual({ lst_p14: "acuerdo_4" });
    expect(usePlanStore.getState().dirty).toBe(true);
    expect(buildGraficosConfig(usePlanStore.getState()).paletas_vinculos).toEqual({ lst_p14: "acuerdo_4" });

    const pasos = usePlanStore.getState().past.length;
    usePlanStore.getState().setPaletaVinculo("lst_p14", "acuerdo_4");
    expect(usePlanStore.getState().past.length).toBe(pasos);

    usePlanStore.getState().undo();
    expect(usePlanStore.getState().paletasVinculos).toEqual({});
    usePlanStore.getState().redo();
    expect(usePlanStore.getState().paletasVinculos).toEqual({ lst_p14: "acuerdo_4" });

    usePlanStore.getState().setPaletaVinculo("lst_p14", null);
    expect(usePlanStore.getState().paletasVinculos).toEqual({});
    expect(buildGraficosConfig(usePlanStore.getState()).paletas_vinculos).toEqual({});
  });

  it("hydrate lee la clave del backend y reset la vacía", () => {
    usePlanStore.getState().hydrate(normalizeGraficosConfig({ paletas_vinculos: { lst_a: "likert" } }) as GraficosConfig);
    expect(usePlanStore.getState().paletasVinculos).toEqual({ lst_a: "likert" });
    usePlanStore.getState().reset();
    expect(usePlanStore.getState().paletasVinculos).toEqual({});
  });
});
