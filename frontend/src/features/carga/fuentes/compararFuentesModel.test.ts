import { describe, expect, it } from "vitest";
import { ApiError } from "../../../api/core";
import { normalizeComparacionFuentes, type VariableComparada } from "../../../api/cargaArmonizacion";
import { PANELES_POR_MODULO } from "../../../lib/navegacion/manifiesto";
import { panelAbiertoEn } from "../../../lib/navegacion/paneles";
import {
  MENSAJE_OTRA_REVISION,
  PANEL_ARMONIZACION_BASE,
  PANEL_COMPARAR_FUENTES,
  anchoBarra,
  avisosPerdidas,
  cabeceraArmonizacion,
  cambiarLado,
  comparablesCon,
  focoComparacion,
  hayFuentesComparables,
  leerFocoComparacion,
  mensajeErrorComparar,
  nombresDeLados,
  ordenarVariables,
  parEfectivo,
  partirCategorias,
  pctConFrecuencia,
  rotuloCasos,
  rotuloDiferenciaFilas,
  rotuloTipoFuente,
  searchConArmonizacionBase,
  searchConComparacion,
  searchSinPanelYFoco,
} from "./compararFuentesModel";

const BASES = [
  { nombre: "sm", instrument_revision_id: "rev-3" },
  { nombre: "docentes", instrument_revision_id: "rev-9" },
  { nombre: "sav", instrument_revision_id: "rev-3" },
  { nombre: "manual", instrument_revision_id: null },
  { nombre: "hija", instrument_revision_id: "rev-9", parent_base: "docentes" },
  { nombre: "excel", instrument_revision_id: "rev-3" },
];

describe("paneles direccionables", () => {
  it("se declaran en Procesamiento con ids propios (armonizacion ya es de Equivalencias)", () => {
    const ids = (PANELES_POR_MODULO.procesamiento ?? []).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["armonizacion-base", "comparar-fuentes", "armonizacion"]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("abrir escribe panel y foco preservando la dirección; cerrar limpia ambos", () => {
    const base = "?seccion=carga&pestana=fuentes";
    const abierto = searchConArmonizacionBase(base, "sm");
    expect(abierto).toBe("?seccion=carga&pestana=fuentes&panel=armonizacion-base&foco=sm");
    expect(panelAbiertoEn(abierto, PANEL_ARMONIZACION_BASE)).toBe(true);
    expect(searchSinPanelYFoco(abierto)).toBe(base);
    const comp = searchConComparacion(base, { a: "sm", b: "sav" });
    expect(panelAbiertoEn(comp, PANEL_COMPARAR_FUENTES)).toBe(true);
    expect(new URLSearchParams(comp).get("foco")).toBe("sm~sav");
  });
});

describe("foco de la comparación", () => {
  it("ida y vuelta, también con «~» y «%» en el nombre", () => {
    for (const par of [{ a: "sm", b: "sav" }, { a: "a~b", b: "c%7Ed" }]) {
      expect(leerFocoComparacion(focoComparacion(par))).toEqual(par);
    }
  });

  it("un foco que no nombra dos bases distintas no es un par", () => {
    expect(leerFocoComparacion("sm")).toBeNull();
    expect(leerFocoComparacion("sm~sm")).toBeNull();
    expect(leerFocoComparacion("~sav")).toBeNull();
    expect(leerFocoComparacion(null)).toBeNull();
  });
});

describe("cuándo se ofrece comparar", () => {
  it("sólo entre bases de la misma revisión, sin hijas de grupos repetidos", () => {
    expect(hayFuentesComparables(BASES)).toBe(true);
    expect(comparablesCon("sm", BASES)).toEqual(["sav", "excel"]);
    expect(comparablesCon("docentes", BASES)).toEqual([]);
    expect(comparablesCon("manual", BASES)).toEqual([]);
    expect(hayFuentesComparables([{ nombre: "x", instrument_revision_id: "r" }, { nombre: "y", instrument_revision_id: "s" }])).toBe(false);
  });

  it("el par efectivo respeta el foco válido y cae al primero si el foco es de otra revisión", () => {
    expect(parEfectivo("sav~excel", BASES)).toEqual({ a: "sav", b: "excel" });
    expect(parEfectivo("sm~docentes", BASES)).toEqual({ a: "sm", b: "sav" });
    expect(parEfectivo(null, BASES)).toEqual({ a: "sm", b: "sav" });
    expect(parEfectivo(null, [{ nombre: "x" }])).toBeNull();
  });

  it("cambiar A conserva B si sigue siendo par; cambiar B a A o a otra revisión no hace nada", () => {
    expect(cambiarLado({ a: "sm", b: "excel" }, "a", "sav", BASES)).toEqual({ a: "sav", b: "excel" });
    expect(cambiarLado({ a: "sm", b: "sav" }, "a", "sav", BASES)).toEqual({ a: "sav", b: "sm" });
    expect(cambiarLado({ a: "sm", b: "sav" }, "b", "sm", BASES)).toEqual({ a: "sm", b: "sav" });
    expect(cambiarLado({ a: "sm", b: "sav" }, "b", "docentes", BASES)).toEqual({ a: "sm", b: "sav" });
    expect(cambiarLado({ a: "sm", b: "sav" }, "a", "docentes", BASES)).toBeNull();
  });
});

describe("rótulos", () => {
  it("nombra la fuente por su tipo", () => {
    expect(rotuloTipoFuente("surveymonkey")).toBe("SurveyMonkey");
    expect(rotuloTipoFuente("formulario_publicado_sav")).toBe("Archivo .sav");
    expect(rotuloTipoFuente("excel")).toBe("Excel");
    expect(rotuloTipoFuente("")).toBe("Fuente sin declarar");
  });

  it("cada lado se nombra por su tipo si difieren y por su base si son del mismo tipo", () => {
    const a = { nombre: "sm", n_filas: 289, fuente: "surveymonkey", datos: "" as const };
    const b = { nombre: "limpia", n_filas: 279, fuente: "sav", datos: "" as const };
    expect(nombresDeLados(a, b)).toEqual({ a: "SurveyMonkey", b: "Archivo .sav" });
    expect(nombresDeLados(a, { ...b, fuente: "surveymonkey" })).toEqual({ a: "sm", b: "limpia" });
  });

  it("casos y diferencia de filas en palabras", () => {
    const lados = { a: "SurveyMonkey", b: "Archivo .sav" };
    expect(rotuloCasos({ clave: "id", en_ambas: 279, solo_a: 10, solo_b: 0 }, lados)).toBe("279 en ambas · 10 solo en SurveyMonkey");
    expect(rotuloCasos(null, lados)).toBeNull();
    expect(rotuloDiferenciaFilas(10, lados)).toBe("SurveyMonkey trae 10 respuestas más");
    expect(rotuloDiferenciaFilas(-1, lados)).toBe("Archivo .sav trae 1 respuesta más");
    expect(rotuloDiferenciaFilas(0, lados)).toBe("Mismo número de respuestas");
  });

  it("el porcentaje nunca va sin su frecuencia, con punto decimal es-PE", () => {
    expect(pctConFrecuencia(51.94, 150)).toBe("51.9 % (150)");
    expect(pctConFrecuencia(null, null)).toBe("—");
    expect(pctConFrecuencia(12.5, 1234)).toBe("12.5 % (1,234)");
    expect(anchoBarra(140)).toBe(100);
    expect(anchoBarra(null)).toBe(0);
  });

  it("cabecera de la armonización: formulario, revisión, fuente y fecha", () => {
    const datos = cabeceraArmonizacion({
      base: "sm", disponible: true, fuente: "sav", importado_at: "2026-10-12T15:04:00Z",
      formulario: { form_id: "f", form_name: "Estudiantes Arte 2026", revision_id: "r", revision_no: 3 },
      detalle: {} as never,
    });
    expect(datos.map((d) => d.clave)).toEqual(["formulario", "revision", "fuente", "importado"]);
    expect(datos[1].valor).toBe("revisión 3");
    expect(datos[2].valor).toBe("Archivo .sav");
    expect(datos[3].valor).toContain("2026");
  });
});

function v(variable: string, estado: VariableComparada["estado"], dif: number | null): VariableComparada {
  return { variable, etiqueta: "", tipo: "", estado, n_validos_a: 1, n_validos_b: 1, categorias: [], diferencia_max_pp: dif, categorias_solo_a: [], categorias_solo_b: [] };
}

describe("orden", () => {
  it("distintas primero por diferencia, luego las de una sola fuente; las iguales aparte en su orden", () => {
    const { destacadas, iguales } = ordenarVariables([
      v("p1", "igual", 0), v("p2", "distinta", 3), v("p3", "solo_a", null), v("p4", "distinta", 12), v("p5", "igual", 0), v("p6", "distinta", null),
    ]);
    expect(destacadas.map((x) => x.variable)).toEqual(["p4", "p2", "p6", "p3"]);
    expect(iguales.map((x) => x.variable)).toEqual(["p1", "p5"]);
  });

  it("los códigos especiales se separan sin quitarse", () => {
    const base = { codigo: "", etiqueta: "", n_a: 1, n_b: 1, pct_a: 1, pct_b: 1, fuera_de_lista: false };
    const { sustantivas, especiales } = partirCategorias([
      { ...base, codigo: "1", especial: false }, { ...base, codigo: "99", especial: true }, { ...base, codigo: "2", especial: false },
    ]);
    expect(sustantivas.map((c) => c.codigo)).toEqual(["1", "2"]);
    expect(especiales.map((c) => c.codigo)).toEqual(["99"]);
  });
});

describe("pérdidas en carga y errores", () => {
  it("avisa qué fuente traía categorías que el formulario no tiene", () => {
    const comp = normalizeComparacionFuentes({
      base_a: { nombre: "sm", fuente: "surveymonkey" },
      base_b: { nombre: "limpia", fuente: "sav" },
      perdidas_en_carga_b: [{ variable: "p3", etiqueta: "No binario", n: 3 }, { variable: "p7", etiqueta: "Otro", n: 2 }],
    });
    const avisos = avisosPerdidas(comp);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ lado: "b", titulo: "El .sav traía categorías que el formulario no tiene", total: 5 });
  });

  it("409 E_COMPARAR_OTRA_REVISION se explica; otro error conserva su mensaje", () => {
    expect(mensajeErrorComparar(new ApiError("E_COMPARAR_OTRA_REVISION", "otra"))).toBe(MENSAJE_OTRA_REVISION);
    expect(mensajeErrorComparar(new Error("fallo · E_COMPARAR_OTRA_REVISION"))).toBe(MENSAJE_OTRA_REVISION);
    expect(mensajeErrorComparar(new Error("sin red"))).toBe("sin red");
  });
});
