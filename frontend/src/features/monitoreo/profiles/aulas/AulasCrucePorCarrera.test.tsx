import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasCrucePorCarrera, type BloqueDeCruce } from "./AulasCrucePorCarrera";
import { railDeAulas } from "./railDeAulas";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * El cruce de alumnos por código PUCP, por la carrera a la que pertenecen.
 *
 * Lo que estas pruebas sujetan: que cuente PERSONAS y no respuestas, que las
 * que no cruzan tengan su motivo —cada uno se arregla en un sitio distinto— y
 * que la pestaña no exista en un estudio anónimo.
 */

const texto = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const BLOQUE: BloqueDeCruce = {
  total: { consideradas: 72, personas: 62, duplicadas: 1, sin_cruce: 9, tasa: 0.875 },
  carreras: [
    { carrera: "ECONOMÍA", personas: 58, duplicadas: 1, poblacion: 358 },
    { carrera: "SOCIOLOGÍA", personas: 4, duplicadas: 0, poblacion: null },
  ],
  sin_cruce: [
    { motivo: "sin_codigo_declarado", etiqueta: "No declararon su código", respuestas: 6 },
    { motivo: "codigo_no_en_padron", etiqueta: "Su código no está en el padrón", respuestas: 3 },
  ],
};

describe("cruce de alumnos por carrera", () => {
  it("titula en PERSONAS y dice cuánto cruzó de cuánto", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("62 alumnos distintos identificados por su código");
    expect(t).toContain("87.5 % de 72");
  });

  it("la repetición se ve donde ocurrió, no sólo en el total", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("1 persona respondió dos veces");
    // Y en su fila: en el total sola no se puede ir a buscar.
    expect(t).toContain("ECONOMÍA · 1 repetida");
  });

  it("sin población del padrón pone un guion, no un cero", () => {
    // «No lo sé» y «son cero» no son lo mismo.
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("de 358");
    expect(t).toContain("—");
  });

  it("nombra cada motivo de no-cruce y dice dónde mirar primero", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={BLOQUE} />));
    expect(t).toContain("Por qué 9 no se pudieron identificar");
    expect(t).toContain("No declararon su código");
    expect(t).toContain("Su código no está en el padrón");
    // La causa más cara es del estudio, no de los alumnos: se dice.
    expect(t).toContain("la columna declarada en Fuentes");
  });

  it("sin motivos no monta el bloque: un cero permanente es ruido", () => {
    const limpio: BloqueDeCruce = {
      ...BLOQUE,
      total: { ...BLOQUE.total, sin_cruce: 0, duplicadas: 0, tasa: 1 },
      sin_cruce: [],
    };
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={limpio} />));
    expect(t).not.toContain("no se pudieron identificar");
    expect(t).not.toContain("respondió dos veces");
  });

  it("contiene su propio vacío cuando todavía no hay respuestas", () => {
    const t = texto(renderToStaticMarkup(<AulasCrucePorCarrera bloque={null} />));
    expect(t).toContain("Todavía no hay respuestas con las que cruzar");
  });
});

describe("la pestaña sólo existe en un estudio confidencial", () => {
  /**
   * Gonzalo, 2026-09-22: «esta pestaña sólo está disponible si la encuesta, en
   * vez de ser anónima, es confidencial. No todos los estudios lo son: las
   * confidenciales piden un código identificador, las anónimas no».
   */
  const tablero = (aplica: boolean | undefined) =>
    ({ cruce_por_carrera: aplica === undefined ? undefined : { aplica } } as unknown as MonitoreoAulasDashboard);

  it("con estudio confidencial la pestaña está", () => {
    const claves = railDeAulas("calidad", tablero(true)).map((t) => t.key);
    expect(claves).toContain("alumnos");
  });

  it("con estudio anónimo la pestaña NO está", () => {
    const claves = railDeAulas("calidad", tablero(false)).map((t) => t.key);
    expect(claves).not.toContain("alumnos");
    // Y las demás siguen enteras: retirar una no puede llevarse las otras.
    expect(claves).toEqual(expect.arrayContaining(["registro", "controles", "base", "abiertas"]));
  });

  it("un payload anterior sin el bloque tampoco la ofrece", () => {
    // Es el estado en el que estaban todos los estudios hasta hoy.
    expect(railDeAulas("calidad", tablero(undefined)).map((t) => t.key)).not.toContain("alumnos");
    expect(railDeAulas("calidad", null).map((t) => t.key)).not.toContain("alumnos");
  });

  it("el filtro es de ESA pestaña: no toca las otras secciones", () => {
    const avance = railDeAulas("avance", tablero(false)).map((t) => t.key);
    expect(avance.length).toBeGreaterThan(0);
  });
});
