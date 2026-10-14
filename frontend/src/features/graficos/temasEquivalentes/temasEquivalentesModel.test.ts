// Enmienda al ADR 0103 «la matriz sugiere, la lámina decide» (P21 del checklist
// docs/qa/checklist-importacion-sm-arte-2026-10-14.md).
//
// El radar entre públicos, la brecha entre dos bases y la serie temporal se
// arman en la lámina con los mismos args de ranura:
//   { vars: {key: ["base$var", ...]}, titulos_grupo?: {key: título}, corte, corte_etiqueta? }
// Este modelo traduce entre esos args y las tarjetas de tema, y dice qué le falta
// a cada graficador para poder dibujarse.

import { describe, expect, it } from "vitest";
import type { VarWithSource } from "../useVariables";
import type { TemaPublicos } from "../multiapiladas/temasPublicos";
import {
  argsATemas,
  faltaEnBrechaBases,
  faltaEnRadarPublicos,
  faltaEnSerie,
  temasAArgs,
} from "./temasEquivalentesModel";

const v = (source: string, name: string, scale_signature = "acuerdo4"): VarWithSource =>
  ({ source, name, label: name, tipo: "select_one", seccion: "", choices: [], scale_signature }) as unknown as VarWithSource;

const variables: VarWithSource[] = [
  v("docentes", "p1"), v("docentes", "p2"), v("docentes", "p3"),
  v("estudiantes", "p1"), v("estudiantes", "p2"), v("estudiantes", "p3"),
  v("estudiantes", "p9", "frecuencia5"),
  v("ola1", "p1"), v("ola2", "p1"), v("ola3", "p1"),
  v("ola2", "p9", "frecuencia5"),
];

const tema = (key: string, title: string, vars: string[]): TemaPublicos => ({ key, title, vars });

const tresTemas = [
  tema("tema_1", "Clima", ["docentes$p1", "estudiantes$p1"]),
  tema("tema_2", "Trato", ["docentes$p2", "estudiantes$p2"]),
  tema("tema_3", "Apoyo", ["docentes$p3", "estudiantes$p3"]),
];

describe("temasAArgs / argsATemas (P21)", () => {
  it("las tarjetas salen como vars por clave y títulos por clave", () => {
    expect(temasAArgs(tresTemas)).toEqual({
      vars: {
        tema_1: ["docentes$p1", "estudiantes$p1"],
        tema_2: ["docentes$p2", "estudiantes$p2"],
        tema_3: ["docentes$p3", "estudiantes$p3"],
      },
      titulos_grupo: { tema_1: "Clima", tema_2: "Trato", tema_3: "Apoyo" },
    });
  });

  it("ida y vuelta exacta, en orden", () => {
    expect(argsATemas(temasAArgs(tresTemas))).toEqual(tresTemas);
  });

  it("ida y vuelta también tras pasar por JSON (lo que guarda el .pulso)", () => {
    const viaje = JSON.parse(JSON.stringify({ ...temasAArgs(tresTemas), corte: "3,4" })) as Record<string, unknown>;
    expect(argsATemas(viaje)).toEqual(tresTemas);
  });
});

describe("faltaEnRadarPublicos", () => {
  it("con tres temas completos y de una escala no falta nada", () => {
    expect(faltaEnRadarPublicos(tresTemas, variables)).toEqual([]);
  });

  it("con dos temas falta al menos un eje (el radar pide tres)", () => {
    expect(faltaEnRadarPublicos(tresTemas.slice(0, 2), variables).length).toBeGreaterThan(0);
  });

  it("una pregunta de otra escala en un tema bloquea", () => {
    const temas = [...tresTemas.slice(0, 2), tema("tema_3", "Apoyo", ["docentes$p3", "estudiantes$p9"])];
    expect(faltaEnRadarPublicos(temas, variables).length).toBeGreaterThan(0);
  });
});

describe("faltaEnBrechaBases", () => {
  const bases = ["docentes", "estudiantes"];

  it("un tema con su pregunta en las dos bases no tiene faltas", () => {
    expect(faltaEnBrechaBases([tresTemas[0]], bases, variables)).toEqual([]);
  });

  it("un tema con una sola referencia falta", () => {
    const temas = [tresTemas[0], tema("tema_2", "Trato", ["docentes$p2"])];
    expect(faltaEnBrechaBases(temas, bases, variables).length).toBeGreaterThan(0);
  });

  it("una pregunta de otra escala en un tema bloquea", () => {
    const temas = [tema("tema_1", "Clima", ["docentes$p1", "estudiantes$p9"])];
    expect(faltaEnBrechaBases(temas, bases, variables).length).toBeGreaterThan(0);
  });
});

describe("faltaEnSerie", () => {
  const periodos = ["ola1", "ola2", "ola3"];

  it("un tema con su pregunta en cada medición no tiene faltas", () => {
    expect(faltaEnSerie([tema("tema_1", "Clima", ["ola1$p1", "ola2$p1", "ola3$p1"])], periodos, variables)).toEqual([]);
  });

  it("un periodo sin su pregunta falta", () => {
    const temas = [tema("tema_1", "Clima", ["ola1$p1", "ola3$p1"])];
    expect(faltaEnSerie(temas, periodos, variables).length).toBeGreaterThan(0);
  });

  it("una pregunta de otra escala en un tema bloquea", () => {
    const temas = [tema("tema_1", "Clima", ["ola1$p1", "ola2$p9", "ola3$p1"])];
    expect(faltaEnSerie(temas, periodos, variables).length).toBeGreaterThan(0);
  });
});
