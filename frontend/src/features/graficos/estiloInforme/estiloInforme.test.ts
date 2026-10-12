import { beforeEach, describe, expect, it } from "vitest";
import type { PresetMetadata } from "../../../api/graficos";
import { nodoPorClave } from "../../../lib/navegacion/manifiesto";
import { parsearDireccionDesdeHref } from "../../../lib/navegacion/direccion";
import { buildGraficosConfigFromStore } from "../configSnapshot";
import { conDisponibilidadEstilo } from "../estilo/disponibilidadEstilo";
import { PESTANAS_GRAFICOS, resolverPestanaGraficos } from "../pestanaGraficos";
import { usePlanStore, type GraficosConfig } from "../store";
import { AMBITO_COMPARTIDO, MOTIVO_WORD_EN_COMPARTIDO, disponibilidadInforme } from "./disponibilidadInforme";
import {
  ARG_METODO,
  bloquesFijados,
  conArg,
  conDecimales,
  conDecimalesEnTodas,
  conMetodoEnTodas,
  conOcultarEtiqueta,
  defaultDeArg,
  ejemploTextoBase,
  errorFormato,
  formatoDesdePartes,
  partesFormato,
  filasCalculos,
  lineaVisualAplicada,
  listasConColor,
  notaRedondeo,
  ocultarEtiquetaSiTitulo,
  procedenciaArg,
  sinArgs,
  sinCalculos,
  textoBase,
  type MapaPresets,
} from "./modeloEstiloInforme";

// Pestaña «Estilo del informe» (A10 W-E; decisiones 28–29; ADR 0094 §4). Cada bloque nombra el mutante que mata.

const BASE: PresetMetadata = {
  name: "base",
  titulo_humano: "Base",
  descripcion: "",
  icono_ui: "Layers",
  args: [
    { name: "formato", label: "Formato", tipo_input: "string", grupo: "textos", default: "Base: %s" },
    { name: "sufijo_auto", label: "Sufijo", tipo_input: "string", grupo: "textos" },
    { name: "nota_redondeo", label: "Nota", tipo_input: "bool", grupo: "valores", default: false },
  ],
};

const APILADAS: PresetMetadata = {
  name: "barras_apiladas",
  titulo_humano: "Barras apiladas",
  descripcion: "",
  icono_ui: "BarChart",
  args: [
    {
      name: "metodo_redondeo", label: "Método", tipo_input: "choice", grupo: "valores", default: "estandar",
      choices: [{ value: "estandar", label: "Estándar" }, { value: "reparto", label: "Reparto" }],
    },
    { name: "decimales", label: "Decimales", tipo_input: "number", grupo: "valores", default: 0 },
    { name: "size_leyenda", label: "Tamaño de la leyenda", tipo_input: "number", grupo: "leyenda", unidad: "pt" },
  ],
  calculos: { familia_porcentaje: true, cierra_100: true, admite_metodo: true, campo_decimales: "decimales" },
  word_fijado: [
    { arg: "size_leyenda", valor: 8, unidad: "pt", motivo: "Lo fija el recetario en el Word: leyenda de 8 pt.", aplica_si_marco: true },
  ],
};

const MULTIPLE: PresetMetadata = {
  name: "barras_multiples",
  titulo_humano: "Respuesta múltiple",
  descripcion: "",
  icono_ui: "BarChart",
  args: [{ name: "decimales_pct", label: "Decimales", tipo_input: "number", grupo: "valores", default: 1 }],
  calculos: { familia_porcentaje: true, cierra_100: false, admite_metodo: false, campo_decimales: "decimales_pct" },
};

const SIN_PORCENTAJE: PresetMetadata = {
  name: "mapa", titulo_humano: "Mapa", descripcion: "", icono_ui: "Map", args: [],
  calculos: { familia_porcentaje: false, cierra_100: false, admite_metodo: false, campo_decimales: "" },
};

const CATALOGO = [BASE, APILADAS, MULTIPLE, SIN_PORCENTAJE];
const DEFAULTS_GET: MapaPresets = { base: { formato: "Base: %s", sufijo_auto: "respuestas" } };

describe("procedencia y diff contra el default (ADR 0094 §4)", () => {
  it("elegir el valor del default borra la clave (mutante: guardar siempre)", () => {
    const presets: MapaPresets = { base: { formato: "n = %s", font_family: "Arial" } };
    const vuelta = conArg(presets, "base", "formato", "Base: %s", "Base: %s");
    expect(vuelta).toEqual({ base: { font_family: "Arial" } });
    expect(presets.base.formato).toBe("n = %s"); // no muta la entrada
  });

  it("un preset que queda sin claves desaparece (mutante: dejar `{}`)", () => {
    expect(conArg({ base: { formato: "n = %s" } }, "base", "formato", "Base: %s", "Base: %s")).toEqual({});
  });

  it("un valor distinto del default se guarda y es «Propio»", () => {
    const p = conArg({}, "base", "formato", "n = %s", "Base: %s");
    expect(p).toEqual({ base: { formato: "n = %s" } });
    expect(procedenciaArg(p, "base", "formato", "Base: %s")).toBe("propio");
  });

  it("una clave guardada igual al default es «Del recetario» (mutante: procedencia = existe la clave)", () => {
    expect(procedenciaArg({ base: { formato: "Base: %s" } }, "base", "formato", "Base: %s")).toBe("recetario");
    expect(procedenciaArg({}, "base", "formato", "Base: %s")).toBe("recetario");
  });

  it("un sufijo vacío es decisión si el recetario pone uno; sin default, vacío no decide nada", () => {
    expect(conArg({}, "base", "sufijo_auto", "", "respuestas")).toEqual({ base: { sufijo_auto: "" } });
    expect(conArg({}, "base", "sufijo_auto", "", undefined)).toEqual({});
  });

  it("«Volver al recetario» borra sólo las claves pedidas (mutante: vaciar el preset)", () => {
    const p: MapaPresets = { base: { formato: "n = %s", sufijo_auto: "casos", size_titulo: 18 } };
    expect(sinArgs(p, "base", ["formato", "sufijo_auto"])).toEqual({ base: { size_titulo: 18 } });
    expect(sinArgs(p, "otro", ["formato"])).toBe(p);
  });

  it("el default del GET manda sobre el del catálogo (mutante: leer sólo `meta.default`)", () => {
    expect(defaultDeArg({ base: { formato: "N = %s" } }, BASE, "base", "formato")).toBe("N = %s");
    expect(defaultDeArg({}, BASE, "base", "formato")).toBe("Base: %s");
  });
});

describe("texto de la base (C48)", () => {
  it("valida el formato como lo compone el motor con sprintf", () => {
    expect(errorFormato("Base: %s")).toBeNull();
    expect(errorFormato("%s (100%%)")).toBeNull();
    expect(errorFormato("Base:")).toMatch(/Falta %s/);
    expect(errorFormato("%s y %s")).toMatch(/una sola vez/);
    expect(errorFormato("%s al 5%")).toMatch(/% suelto/);
    expect(errorFormato("%d casos %s")).toMatch(/% suelto/);
  });

  it("I6: el texto de la base se arma sin escribir %s y vuelve igual al motor", () => {
    expect(partesFormato("Base: %s")).toEqual({ inicio: "Base:", fin: "" });
    expect(partesFormato("%s (100%%)")).toEqual({ inicio: "", fin: " (100%)" });
    expect(partesFormato("Base:")).toEqual({ inicio: "Base:", fin: "" }); // inválido: se lee el de siempre
    expect(formatoDesdePartes({ inicio: "Total encuestados:", fin: "" })).toBe("Total encuestados: %s");
    expect(formatoDesdePartes({ inicio: "  ", fin: "" })).toBe("%s");
    // Un % que escribe el usuario no rompe el motor: sale escapado y el formato sigue siendo válido.
    const conPorcentaje = formatoDesdePartes({ inicio: "Base 100%", fin: " (100%)" });
    expect(conPorcentaje).toBe("Base 100%% %s (100%%)");
    expect(errorFormato(conPorcentaje)).toBeNull();
    expect(partesFormato(conPorcentaje)).toEqual({ inicio: "Base 100%", fin: " (100%)" });
    expect(ejemploTextoBase(formatoDesdePartes({ inicio: "Base:", fin: "" }), "estudiantes", 172)).toBe("Base: 172 estudiantes");
  });

  it("el ejemplo pone conteo y sufijo en el %s", () => {
    expect(ejemploTextoBase("Base: %s", "respuestas", 120)).toBe("Base: 120 respuestas");
    expect(ejemploTextoBase("n = %s", "  ", 52)).toBe("n = 52");
    expect(ejemploTextoBase("%s (100%%)", "casos", 7)).toBe("7 casos (100%)");
  });

  it("deriva valor, default y procedencia por campo, y el ejemplo no usa un formato inválido", () => {
    const t = textoBase({ base: { sufijo_auto: "docentes" } }, DEFAULTS_GET, BASE);
    expect(t.formato).toMatchObject({ valor: "Base: %s", porDefecto: "Base: %s", procedencia: "recetario" });
    expect(t.sufijo).toMatchObject({ valor: "docentes", porDefecto: "respuestas", procedencia: "propio" });
    expect(t.modificado).toBe(true);
    expect(t.ejemplo).toBe("Base: 120 docentes");
    expect(textoBase({ base: { formato: "roto" } }, DEFAULTS_GET, BASE).ejemplo).toBe("Base: 120 respuestas");
    expect(textoBase({}, DEFAULTS_GET, BASE).modificado).toBe(false);
  });
});

describe("cálculos (C50)", () => {
  it("sólo las familias que rotulan porcentajes, con default y procedencia por fila", () => {
    const filas = filasCalculos(CATALOGO, { barras_multiples: { decimales_pct: 1 } }, {});
    expect(filas.map((f) => f.preset)).toEqual(["barras_apiladas", "barras_multiples"]);
    expect(filas[0]).toMatchObject({ metodo: "estandar", decimales: 0, procedencia: "recetario", admiteMetodo: true });
    // Guardado igual al default: no es decisión.
    expect(filas[1]).toMatchObject({ metodo: "estandar", decimales: 1, procedencia: "recetario", admiteMetodo: false });
  });

  it("«Aplicar a todos» no cambia el método de una familia sin resto que repartir (mutante: aplicar a todas)", () => {
    const filas = filasCalculos(CATALOGO, {}, {});
    const p = conMetodoEnTodas({}, filas, "reparto");
    expect(p).toEqual({ barras_apiladas: { [ARG_METODO]: "reparto" } });
    const vuelta = conMetodoEnTodas(p, filas, "estandar");
    expect(vuelta).toEqual({});
  });

  it("los decimales se acotan a 0–2 y el default borra la clave", () => {
    const filas = filasCalculos(CATALOGO, {}, {});
    expect(conDecimales({}, filas[0], 7)).toEqual({ barras_apiladas: { decimales: 2 } });
    expect(conDecimalesEnTodas({}, filas, 1)).toEqual({ barras_apiladas: { decimales: 1 } });
  });

  it("«Volver al recetario» de una fila borra método y decimales, nada más", () => {
    const presets: MapaPresets = { barras_apiladas: { metodo_redondeo: "reparto", decimales: 1, size_leyenda: 9 } };
    const [fila] = filasCalculos(CATALOGO, presets, {});
    expect(fila.procedencia).toBe("propio");
    expect(sinCalculos(presets, fila)).toEqual({ barras_apiladas: { size_leyenda: 9 } });
  });

  it("la nota del redondeo vive en `base` y compara contra su default", () => {
    expect(notaRedondeo({}, {}, BASE)).toEqual({ activa: false, porDefecto: false, procedencia: "recetario" });
    expect(notaRedondeo({ base: { nota_redondeo: true } }, {}, BASE)).toEqual({ activa: true, porDefecto: false, procedencia: "propio" });
    expect(notaRedondeo({ base: { nota_redondeo: true } }, { base: { nota_redondeo: true } }, BASE).procedencia).toBe("recetario");
  });
});

describe("paletas (C51) y línea visual (C52)", () => {
  it("cuenta listas con algún color propio", () => {
    expect(listasConColor({})).toBe(0);
    expect(listasConColor({ lst_a: { Sí: "#00A0E3" }, lst_b: {}, lst_c: { No: "" } })).toBe(1);
  });

  it("lee la línea aplicada de `scope_rules.global.profile_id`", () => {
    expect(lineaVisualAplicada({})).toBeNull();
    expect(lineaVisualAplicada({ global: { profile_id: " acnur " } })).toBe("acnur");
    expect(lineaVisualAplicada({ global: { profile_id: "" } })).toBeNull();
  });
});

describe("Word reducido con candado (C49, decisión 29)", () => {
  const referencia: MapaPresets = { chart_options: { ocultar_etiqueta_si_titulo: true }, chart_presets: { barras_apiladas: { size_leyenda: 8 } } };

  it("la opción es «Propio» sólo si difiere de la referencia", () => {
    expect(ocultarEtiquetaSiTitulo(referencia, referencia)).toEqual({ activa: true, porDefecto: true, procedencia: "recetario" });
    const apagada = conOcultarEtiqueta(referencia, referencia, false);
    expect(ocultarEtiquetaSiTitulo(apagada, referencia)).toEqual({ activa: false, porDefecto: true, procedencia: "propio" });
  });

  it("volver al valor del recetario repone el de la referencia y conserva lo demás", () => {
    const actual: MapaPresets = { ...referencia, chart_options: { ocultar_etiqueta_si_titulo: false, otra: 1 } };
    const vuelta = conOcultarEtiqueta(actual, referencia, true);
    expect(vuelta.chart_options).toEqual({ ocultar_etiqueta_si_titulo: true, otra: 1 });
    expect(vuelta.chart_presets).toBe(actual.chart_presets);
    // Sin la clave en la referencia, volver la borra (mutante: escribir `true`).
    expect(conOcultarEtiqueta({ chart_options: { ocultar_etiqueta_si_titulo: false } }, {}, true).chart_options).toEqual({});
  });

  it("un bloque por tipo con candado y, sólo si es decisión, el valor que el proyecto guarda", () => {
    expect(bloquesFijados(CATALOGO, referencia, referencia)).toEqual([
      { preset: "barras_apiladas", titulo: "Barras apiladas", lineas: [{ fijado: APILADAS.word_fijado![0], meta: APILADAS.args[2] }] },
    ]);
    const conViejo: MapaPresets = { ...referencia, chart_presets: { barras_apiladas: { size_leyenda: 6 } } };
    expect(bloquesFijados(CATALOGO, conViejo, referencia)[0].lineas[0].guardado).toBe(6);
  });
});

describe("dirección y disponibilidad (decisión 28)", () => {
  it("`?pestana=estilo-informe` es una pestaña propia del catálogo, con alias de mayúsculas y guion bajo", () => {
    expect(PESTANAS_GRAFICOS.map((p) => p.key)).toContain("estilo-informe");
    expect(resolverPestanaGraficos("estilo-informe")).toBe("estilo-informe");
    expect(resolverPestanaGraficos("Estilo_Informe")).toBe("estilo-informe");
    expect(resolverPestanaGraficos("estilo")).toBe("estilo");
    const nodo = nodoPorClave("procesamiento/graficos/estilo-informe");
    expect(nodo).not.toBeNull();
    expect(nodo?.href).toContain("pestana=estilo-informe");
    expect(parsearDireccionDesdeHref(nodo?.href ?? "")?.pestana).toBe("estilo-informe");
  });

  it("habilitada también en el informe compartido; sólo el Word dice por qué no se ajusta ahí", () => {
    const rail = conDisponibilidadEstilo(PESTANAS_GRAFICOS, "consolidated");
    expect(rail.find((p) => p.key === "estilo-informe")).not.toHaveProperty("disabled", true);
    expect(rail.find((p) => p.key === "estilo")).toHaveProperty("disabled", true);
    expect(disponibilidadInforme("consolidated")).toEqual({ disponible: true, ambito: AMBITO_COMPARTIDO, motivoWord: MOTIVO_WORD_EN_COMPARTIDO });
    expect(disponibilidadInforme("active").motivoWord).toBeNull();
  });
});

describe("escribe donde ya escribe el Estilo global: el store del plan y su autosave", () => {
  beforeEach(() => {
    usePlanStore.getState().hydrate({
      version: "graficos/4", plan: { slides: [] }, presets: { base: { size_titulo: 18 } }, w_presets: {},
      selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
      debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    } as GraficosConfig);
  });

  it("un cambio es un paso deshacible y viaja en `presets` de la config que guarda el autosave", () => {
    const s = usePlanStore.getState();
    s.setPresets(conArg(s.presets, "base", "nota_redondeo", true, false));
    expect(usePlanStore.getState().dirty).toBe(true);
    expect(buildGraficosConfigFromStore().presets).toEqual({ base: { size_titulo: 18, nota_redondeo: true } });
    usePlanStore.getState().undo();
    expect(buildGraficosConfigFromStore().presets).toEqual({ base: { size_titulo: 18 } });
  });
});
