import { describe, expect, it } from "vitest";
import type { PonderPreview, PonderWarning } from "../../../api/analitica";
import type { PonderacionConfig } from "../store";
import { AVISO_DEFF_ALTO, avisosDelEfecto } from "./avisosDelEfecto";
import type { LecturaDelEfecto } from "./calculoDePonderacion";
import { cifrasDeLaCabecera, estadoDePonderacion } from "./estadoYCifrasDeCabecera";
import { pasosDePonderacion } from "./pasosDelRecorrido";

const DIAG = { n: 1283, n_eff: 794, deff: 1.62, cv: 0.78, loss_pct: 38, min: 0.6, max: 4.51, mean: 1, median: 1, ratio_max_min: 7.5 };
const conMetas = (extra: Partial<PonderacionConfig> = {}): PonderacionConfig => ({
  enabled: true, rake: { margins: [{ var: "sexo", targets: { "1": 49.5, "2": 50.5 } }] }, ...extra,
});
const efecto = (preview: PonderPreview = { ok: true, rake_applied: true, diagnostics: DIAG }): LecturaDelEfecto =>
  ({ tipo: "efecto", preview, recalculando: false });
const estados = (pond: PonderacionConfig, lectura: LecturaDelEfecto) => pasosDePonderacion(pond, lectura).map((p) => p.estado);

describe("recorrido de Ponderación", () => {
  it("son los cuatro pasos del prototipo, en su orden", () => {
    expect(pasosDePonderacion(conMetas(), efecto()).map((p) => p.rotulo)).toEqual(["Peso base", "Metas de la población", "Ajustes", "Efecto"]);
  });

  it("apagada: ningún paso hecho y ninguno actual", () => {
    expect(estados({ enabled: false, rake: { margins: [] } }, { tipo: "inactivo" })).toEqual(["pendiente", "pendiente", "pendiente", "pendiente"]);
  });

  it("sin variables con metas, el actual es Metas; con metas y efecto calculado, todos hechos", () => {
    expect(estados({ enabled: true, rake: { margins: [{ var: "sexo", targets: {} }] } }, { tipo: "sin-efecto" }))
      .toEqual(["hecho", "actual", "hecho", "pendiente"]);
    expect(estados(conMetas(), efecto())).toEqual(["hecho", "hecho", "hecho", "hecho"]);
    // Mientras se calcula por primera vez, el efecto todavía no está hecho.
    expect(estados(conMetas(), { tipo: "calculando" })).toEqual(["hecho", "hecho", "hecho", "actual"]);
  });

  it("un peso base de columna sin elegir es el paso actual; un estrato sin población, también", () => {
    expect(estados(conMetas({ design: { peso_columna: "" } }), efecto())[0]).toBe("actual");
    expect(estados(conMetas({ design: { var: "distrito", pop_sizes: {} } }), efecto())[0]).toBe("actual");
    expect(estados(conMetas({ design: { var: "distrito", pop_sizes: { a: 100 } } }), efecto())[0]).toBe("hecho");
  });

  it("un peso base declarado basta para calibrar: las metas no quedan pendientes", () => {
    const pond: PonderacionConfig = { enabled: true, design: { peso_columna: "factor" }, rake: { margins: [] } };
    expect(estados(pond, efecto())).toEqual(["hecho", "hecho", "hecho", "hecho"]);
  });

  it("un cálculo detenido se corrige en Ajustes", () => {
    expect(estados(conMetas(), { tipo: "error", causa: "x", reintentable: false })).toEqual(["hecho", "hecho", "actual", "pendiente"]);
  });

  it("con el peso tomado de una columna, metas, ajustes y efecto no aplican y lo dicen", () => {
    const pasos = pasosDePonderacion({ enabled: true, modo: "columna", peso_columna: "w", rake: { margins: [] } }, { tipo: "inactivo" });
    expect(pasos.map((p) => p.estado)).toEqual(["hecho", "no-aplica", "no-aplica", "no-aplica"]);
    expect(pasos[1].titulo).toContain("columna");
    expect(pasosDePonderacion({ enabled: true, modo: "columna", rake: { margins: [] } }, { tipo: "inactivo" })[0].estado).toBe("actual");
  });
});

describe("cabecera de Ponderación", () => {
  it("el estado se dice en palabra", () => {
    expect(estadoDePonderacion({ enabled: false, rake: { margins: [] } }, { tipo: "inactivo" })).toEqual({ tono: "neutro", texto: "Apagada" });
    expect(estadoDePonderacion(conMetas(), efecto()).texto).toBe("Activa");
    expect(estadoDePonderacion(conMetas(), { tipo: "sin-efecto" }).texto).toBe("Incompleta");
    expect(estadoDePonderacion(conMetas(), { tipo: "error", causa: "x", reintentable: true }).texto).toBe("Sin calcular");
  });

  it("las cifras son lo declarado, en minúscula bajo el número, y nunca las del efecto", () => {
    const cifras = cifrasDeLaCabecera(conMetas(), { ok: true, rake_applied: true, total_poblacion: 486, diagnostics: DIAG });
    expect(cifras.map((c) => [c.valor, c.rotulo])).toEqual([["1", "variables de ajuste"], ["486", "suma de pesos"]]);
    expect(cifras.map((c) => c.valor)).not.toContain("794");
    // Sin pesos de expansión el motor no publica el total: no se inventa.
    expect(cifrasDeLaCabecera(conMetas(), { ok: true, rake_applied: true, diagnostics: DIAG }).map((c) => c.clave)).toEqual(["variables-de-ajuste"]);
  });

  it("apagada o con el peso de una columna, la cabecera no lleva cifras", () => {
    expect(cifrasDeLaCabecera({ enabled: false, rake: { margins: [] } }, null)).toEqual([]);
    expect(cifrasDeLaCabecera({ enabled: true, modo: "columna", rake: { margins: [] } }, null)).toEqual([]);
  });
});

describe("avisos del efecto sin cifras repetidas", () => {
  const aviso = (code: string, message = `aviso ${code}`, level: PonderWarning["level"] = "warn"): PonderWarning => ({ code, message, level });

  it("el aviso que solo repite el tamaño efectivo y el efecto de diseño no se muestra", () => {
    const motor = aviso("deff_medio", "Por la ponderación, el tamaño efectivo de la muestra es 794 de 1283 casos (38 % menos; efecto de diseño por ponderación de 1.62).", "info");
    expect(avisosDelEfecto([motor])).toEqual([]);
  });

  it("el de efecto de diseño alto conserva el consejo, sin las cifras", () => {
    const [unico] = avisosDelEfecto([aviso("deff_alto", "Efecto de diseño por ponderación alto (2.10): el tamaño efectivo de la muestra baja a 612 de 1283 casos (52 % menos). Calibra con menos variables o revisa si la ponderación es necesaria.")]);
    expect(unico.message).toBe(AVISO_DEFF_ALTO);
    expect(unico.message).not.toMatch(/\d/);
    expect(unico.level).toBe("warn");
  });

  it("los demás avisos pasan tal cual y en su orden", () => {
    const otros = [aviso("categoria_fuera_de_margen"), aviso("deff_medio"), aviso("pesos_extremos")];
    expect(avisosDelEfecto(otros).map((a) => a.code)).toEqual(["categoria_fuera_de_margen", "pesos_extremos"]);
    expect(avisosDelEfecto(undefined)).toEqual([]);
  });
});
