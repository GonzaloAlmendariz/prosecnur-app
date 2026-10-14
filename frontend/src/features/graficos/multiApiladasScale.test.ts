import { describe, expect, it } from "vitest";
import {
  describeScale,
  evaluateScaleCompat,
  multiApiladasScaleGroups,
  scaleKeyOf,
  type ScaleVar,
} from "./multiApiladasScale";

const SI_NO: ScaleVar = {
  name: "p10_3",
  list_name: "lst_p10",
  scale_signature: "1=Sí|2=No",
  choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }],
};

// Mismo juego de opciones, otro list_name: es lo que produce el importador
// de SurveyMonkey (una lista por pregunta).
const SI_NO_OTRA_LISTA: ScaleVar = { ...SI_NO, name: "p14_3", list_name: "lst_p14" };

const ACUERDO: ScaleVar = {
  name: "p12_1",
  list_name: "lst_p12",
  scale_signature: "1=Totalmente de acuerdo|2=De acuerdo|3=En desacuerdo|4=Totalmente en desacuerdo",
  choices: [
    { name: "1", label: "Totalmente de acuerdo" },
    { name: "2", label: "De acuerdo" },
    { name: "3", label: "En desacuerdo" },
    { name: "4", label: "Totalmente en desacuerdo" },
  ],
};

const catalog: Record<string, ScaleVar> = {
  "egresados$p10_3": SI_NO,
  "docentes$p14_3": SI_NO_OTRA_LISTA,
  "egresados$p12_1": ACUERDO,
};
const resolve = (ref: string) => catalog[ref];

describe("describeScale", () => {
  it("nombra la escala por sus categorías, no por el list_name", () => {
    expect(describeScale(SI_NO)).toBe("Sí / No");
    expect(describeScale(SI_NO)).not.toContain("lst_");
  });

  it("resume las escalas largas por sus extremos", () => {
    expect(describeScale(ACUERDO)).toBe("Totalmente de acuerdo … Totalmente en desacuerdo (4 categorías)");
  });

  it("es explícita cuando no hay categorías", () => {
    expect(describeScale({ name: "x" })).toBe("escala sin categorías declaradas");
  });
});

describe("scaleKeyOf", () => {
  it("compara por firma de contenido, así que dos list_name distintos concilian", () => {
    expect(scaleKeyOf(SI_NO)).toBe(scaleKeyOf(SI_NO_OTRA_LISTA));
  });
});

describe("evaluateScaleCompat", () => {
  it("acepta preguntas equivalentes aunque el importador les diera listas distintas", () => {
    const verdict = evaluateScaleCompat(["egresados$p10_3", "docentes$p14_3"], resolve);
    expect(verdict.tone).toBe("ok");
    expect(verdict.label).toBe("Sí / No");
  });

  it("rechaza escalas distintas y nombra ambas por sus categorías", () => {
    const verdict = evaluateScaleCompat(["egresados$p10_3", "egresados$p12_1"], resolve);
    expect(verdict.tone).toBe("error");
    expect(verdict.message).toContain("Sí / No");
    expect(verdict.message).toContain("Totalmente de acuerdo");
    expect(verdict.message).toContain("Combinar bloques");
  });

  it("no opina sin preguntas ni con variables ausentes", () => {
    expect(evaluateScaleCompat([], resolve).tone).toBe("idle");
    expect(evaluateScaleCompat(["egresados$fantasma"], resolve).tone).toBe("warning");
  });
});

describe("multiApiladasScaleGroups", () => {
  it("agrupa las preguntas de un modo simple", () => {
    expect(multiApiladasScaleGroups({ modo: "var", vars: ["a", "b"] })).toEqual([["a", "b"]]);
  });

  it("ignora una sola pregunta: no hay nada que conciliar", () => {
    expect(multiApiladasScaleGroups({ modo: "var", vars: ["a"] })).toEqual([]);
  });

  it("ignora el modo cruce, que apila las opciones de una sola pregunta", () => {
    expect(multiApiladasScaleGroups({ modo: "cruce", var: "a", cruces: "sexo" })).toEqual([]);
  });

  it("aplana los temas de comparar públicos en un único grupo", () => {
    const groups = multiApiladasScaleGroups({
      modo: "var_cruce",
      vars: { tema_1: ["docentes$p1", "egresados$p2"] },
    });
    expect(groups).toEqual([["docentes$p1", "egresados$p2"]]);
  });

  it("valida cada bloque de multilista por separado", () => {
    // Combinar bloques existe para mezclar escalas ENTRE bloques: un bloque
    // Likert junto a otro Sí/No es válido y no debe reportarse como conflicto.
    const groups = multiApiladasScaleGroups({
      modo: "multilista",
      bloques: [
        { modo: "var", vars: ["a", "b"] },
        { modo: "var", vars: ["c", "d"] },
      ],
    });
    expect(groups).toEqual([["a", "b"], ["c", "d"]]);
  });
});
