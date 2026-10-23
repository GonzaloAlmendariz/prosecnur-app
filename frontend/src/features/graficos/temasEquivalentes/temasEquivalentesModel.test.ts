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
  avisoCriteriosRadar,
  REGLA_CRITERIOS_RADAR,
  faltaEnBrechaBases,
  faltaEnRadarPublicos,
  faltaEnSerie,
  patchModoRadar,
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

// Arte (P12): la lámina 33 quedó en `modo = "box"` con el `var` del modo «sm» y ocho preguntas planas, y no exportaba.
// Cambiar de modo deja los args del anterior; `null` los borra (mergeSlotArgsPatch).
const aplicar = (args: Record<string, unknown>, patch: Record<string, unknown>) => {
  const out = { ...args };
  for (const [k, val] of Object.entries(patch)) {
    if (val === null || val === undefined) delete out[k];
    else out[k] = val;
  }
  return out;
};

describe("patchModoRadar", () => {
  it("de «sm» a «box» suelta `var`, que el modo «box» no admite, y conserva `cruce`", () => {
    const antes = { modo: "sm", var: "estudiantes$p17_1", cruce: "estudiantes$sexo", mostrar_valores: true };
    const despues = aplicar(antes, patchModoRadar("sm", "box"));
    expect(despues).toEqual({ modo: "box", cruce: "estudiantes$sexo", mostrar_valores: true });
  });

  it("de «box» a «sm» suelta `vars` y `box_labels`", () => {
    const antes = { modo: "box", vars: ["a$p1", "a$p2"], box_labels: ["De acuerdo", "Total"], cruce: "a$sexo" };
    expect(aplicar(antes, patchModoRadar("box", "sm"))).toEqual({ modo: "sm", cruce: "a$sexo" });
  });

  it("de «box» a «publicos» reinicia las preguntas y suelta lo propio de «box» y «sm»", () => {
    const antes = { modo: "box", var: "a$p1", vars: ["a$p1"], box_labels: ["x", "y"], cruce: "a$sexo", top_n: 5 };
    const despues = aplicar(antes, patchModoRadar("box", "publicos"));
    expect(despues).toEqual({ modo: "publicos", vars: {}, top_n: 5 });
  });

  it("de «publicos» a «box» suelta lo propio de «publicos» y reinicia las preguntas como lista", () => {
    const antes = {
      modo: "publicos", vars: { t1: ["docentes$p1", "estudiantes$p1"] }, titulos_grupo: { t1: "Tema" }, corte: "3,4",
      corte_etiqueta: "De acuerdo", estilo: "comparativo", mostrar_tabla: true, tabla_proporcion: 1.2, mostrar_valores: false,
    };
    expect(aplicar(antes, patchModoRadar("publicos", "box"))).toEqual({ modo: "box", vars: [], mostrar_valores: false });
  });

  it("el mismo modo sólo reescribe `modo`", () => {
    expect(patchModoRadar("box", "box")).toEqual({ modo: "box" });
  });
});

describe("avisoCriteriosRadar", () => {
  it("la regla fija dice mínimo 5 y líneas y puntos con menos", () => {
    expect(REGLA_CRITERIOS_RADAR).toMatch(/5 a 8 criterios.*líneas y puntos/);
    expect(REGLA_CRITERIOS_RADAR).toMatch(/el eje se acerca a los datos y puede cambiarse/);
  });
  it("de 5 a 8 criterios no avisa", () => {
    for (const n of [5, 6, 8]) expect(avisoCriteriosRadar(n)).toBeNull();
  });
  it("con menos de 5 dice que se dibuja como líneas y puntos, con el número", () => {
    expect(avisoCriteriosRadar(4)).toMatch(/Hay 4 criterios.*líneas y puntos comparativos/);
    expect(avisoCriteriosRadar(4)).not.toMatch(/barras/);
    expect(avisoCriteriosRadar(1)).toMatch(/Hay 1 criterio:/);
  });
  it("con más de 8 avisa que puede no leerse bien", () => {
    expect(avisoCriteriosRadar(9)).toMatch(/más de 8/);
  });
  it("sin criterios no avisa", () => {
    expect(avisoCriteriosRadar(0)).toBeNull();
  });
});
