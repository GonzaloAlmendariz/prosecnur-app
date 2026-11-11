import { describe, expect, it } from "vitest";

import { FrecuenciasPreviewInvalida, normalizarFrecuenciasPreview } from "../../../api/analitica";
import { RESPUESTA_REAL, RESPUESTA_REAL_SIN_PESOS } from "./ejemploDeVistaPrevia.test-util";

/**
 * El normalizador de la vista previa de Frecuencias (`api/analitica.ts`),
 * contrato v2. La respuesta real pasa sin cambios; las rarezas de la
 * serialización de R se aplanan; lo que sostiene una cifra falla con el campo
 * nombrado.
 */

type Crudo = Record<string, unknown> & { tablas: Record<string, unknown>[] };
const real = (x: unknown = RESPUESTA_REAL) => JSON.parse(JSON.stringify(x)) as Crudo;
const indice = (raw: Crudo, variable: string) => raw.tablas.findIndex((t) => t.variable === variable);

describe("normalizador de la vista previa de Frecuencias", () => {
  it("la respuesta real con pesos llega con la forma del contrato v2 y las cifras intactas", () => {
    const p = normalizarFrecuenciasPreview(real());
    expect(p.total_variables).toBe(26);
    expect(p.devueltas).toBe(26);
    expect(p.recortado).toBe(false);
    expect(p.ponderado).toBe(true);
    expect(p.fuente).toBe("adaptados");
    expect(p.ponderacion.escala).toBe("normalizada");
    expect(p.casos.con_peso).toBe(1283);
    const medios = p.tablas.find((t) => t.variable === "D1_information");
    expect(medios?.tipo).toBe("multiple");
    expect(medios?.filas[0]).toEqual({ codigo: "1", etiqueta: medios?.filas[0].etiqueta, n: 375.321909613887, pct: 0.653210851377324, especial: false });
    expect(medios?.total).toEqual({ n: 574.580028519893, pct: 1 });
    // La base, en casos sin ponderar; sin `ponderado`.
    expect(medios?.base).toEqual({ n: 560, de: 1283, denominador: "marcaron_alguna_opcion" });
    const sinDatos = p.tablas.find((t) => t.variable === "whynotconsent");
    expect(sinDatos?.sin_datos).toBe(true);
    expect(sinDatos?.filas).toEqual([]);
    expect(p.sin_tabla).toEqual([]);
    expect(p.avisos).toEqual([]);
    // El sello trae comillas angulares: no viaja a la UI.
    expect(JSON.stringify(p)).not.toMatch(/[«»]/);
  });

  it("sin pesos: escala nula y base igual al total", () => {
    const p = normalizarFrecuenciasPreview(real(RESPUESTA_REAL_SIN_PESOS));
    expect(p.ponderado).toBe(false);
    expect(p.ponderacion.escala).toBeNull();
    const empleo = p.tablas.find((t) => t.variable === "M4_employment");
    expect(empleo?.base.n).toBe(empleo?.total.n);
  });

  it("si el servicio todavía manda base.ponderado, se ignora", () => {
    const raw = real();
    const i = indice(raw, "M4_employment");
    (raw.tablas[i].base as Record<string, unknown>).ponderado = true;
    const base = normalizarFrecuenciasPreview(raw).tablas[i].base;
    expect(base).toEqual({ n: 1283, de: 1283, denominador: "respondieron" });
    expect("ponderado" in base).toBe(false);
  });

  it("aplana lo que R serializa raro: escalares en arreglo, listas nulas o vacías como objeto", () => {
    const raw = real();
    raw.total_variables = [26];
    raw.ponderado = [true];
    raw.fuente = ["adaptados"];
    raw.escala_pct = ["proporcion"];
    raw.sin_tabla = {};
    raw.avisos = null;
    const i = indice(raw, "M4_employment");
    const t = raw.tablas[i];
    t.variable = ["M4_employment"];
    t.tipo = ["unica"];
    t.resumen = {};
    t.notas = "Fuente: Pulso PUCP.";
    t.seccion = [{ nombre: ["Datos Generales"], rotulo: {} }];
    (t.filas as Record<string, unknown>[])[0].codigo = [null];
    (t.filas as Record<string, unknown>[])[1].n = ["350"];
    // Una tabla con una sola fila llega como objeto, no como lista.
    const j = indice(raw, "D1_information");
    raw.tablas[j].filas = { codigo: "1", etiqueta: "Redes sociales", n: 375.3, pct: 0.6532, especial: false };
    const p = normalizarFrecuenciasPreview(raw);
    expect(p.total_variables).toBe(26);
    expect(p.ponderado).toBe(true);
    expect(p.fuente).toBe("adaptados");
    expect(p.sin_tabla).toEqual([]);
    expect(p.avisos).toEqual([]);
    expect(p.tablas[i].variable).toBe("M4_employment");
    expect(p.tablas[i].resumen).toEqual([]);
    expect(p.tablas[i].notas).toEqual(["Fuente: Pulso PUCP."]);
    expect(p.tablas[i].seccion).toEqual({ nombre: "Datos Generales", rotulo: null });
    expect(p.tablas[i].filas[0].codigo).toBeNull();
    expect(p.tablas[i].filas[1].n).toBe(350);
    expect(p.tablas[j].filas).toHaveLength(1);
  });

  it("un motivo desconocido de una variable sin tabla cae en desconocida; un aviso sin texto se descarta", () => {
    const raw = real();
    raw.sin_tabla = [{ variable: "p9", motivo: "otro" }, { variable: ["p10"], motivo: ["excluida"] }, { motivo: "excluida" }];
    raw.avisos = [{ codigo: "motor", mensaje: "La columna de pesos tiene valores vacíos." }, { codigo: "motor" }];
    const p = normalizarFrecuenciasPreview(raw);
    expect(p.sin_tabla).toEqual([{ variable: "p9", motivo: "desconocida" }, { variable: "p10", motivo: "excluida" }]);
    expect(p.avisos).toEqual([{ codigo: "motor", mensaje: "La columna de pesos tiene valores vacíos." }]);
  });

  it("falla nombrando el campo cuando falta lo que sostiene una cifra", () => {
    const sinTotal = real();
    delete sinTotal.total_variables;
    expect(() => normalizarFrecuenciasPreview(sinTotal)).toThrow(FrecuenciasPreviewInvalida);
    expect(() => normalizarFrecuenciasPreview(sinTotal)).toThrow('"total_variables"');

    // Otra escala de porcentajes no se adivina.
    const otraEscala = real();
    otraEscala.escala_pct = "porcentaje";
    expect(() => normalizarFrecuenciasPreview(otraEscala)).toThrow('"escala_pct"');
    const sinEscala = real();
    delete sinEscala.escala_pct;
    expect(() => normalizarFrecuenciasPreview(sinEscala)).toThrow('"escala_pct"');

    const tipoRaro = real();
    const i = indice(tipoRaro, "M4_employment");
    tipoRaro.tablas[i].tipo = "abierta";
    expect(() => normalizarFrecuenciasPreview(tipoRaro)).toThrow(`"tablas[${i}].tipo"`);

    const filaSinCasos = real();
    delete (filaSinCasos.tablas[i].filas as Record<string, unknown>[])[2].n;
    expect(() => normalizarFrecuenciasPreview(filaSinCasos)).toThrow(`"tablas[${i}].filas[2].n"`);

    expect(() => normalizarFrecuenciasPreview(null)).toThrow('"respuesta"');
    expect(() => normalizarFrecuenciasPreview("ok")).toThrow('"respuesta"');
  });
});
