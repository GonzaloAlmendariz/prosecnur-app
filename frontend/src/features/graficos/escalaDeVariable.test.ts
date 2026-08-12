import { describe, expect, it } from "vitest";
import { escalasParaSembrar, escalasParaVariable } from "./escalaDeVariable";
import type { PaletaSugeridaEntry } from "../../api/graficos";

// En «Conta 10-08» un mismo `list_name` es una escala distinta por base:
// `lst_p4_recod` son rangos de edad de docentes y OTROS rangos en egresados, y
// `lst_p10` es Sí/No en docentes y meses desde el egreso en egresados. Casar
// por el nombre pelado devolvería la escala de otra población.

const esc = (
  list_name: string,
  escala_id: string,
  labels: string[],
  variables: string[],
): PaletaSugeridaEntry => ({
  list_name,
  escala_id,
  choices: labels.map((l, i) => ({ name: String(i + 1), label: l })),
  variables,
});

const LISTAS = [
  esc("lst_p4_recod", "lst_p4_recod", ["De 51 años a más", "De 41 a 50 años", "De 31 a 40 años", "De 18 a 30 años"], ["docentes$p4_recod"]),
  esc("lst_p4_recod", "lst_p4_recod#2", ["De 30 a 35 años", "De 22 a 25 años", "De 26 a 29 años", "De 36 años a más"], ["egresados$p4_recod"]),
  esc("lst_p10", "lst_p10", ["Sí", "No"], ["docentes$p10", "administrativos$p10"]),
  esc("lst_p10", "lst_p10#2", ["0 meses", "Menos de 2 meses", "Más de 1 año"], ["egresados$p10"]),
  esc("lst_sexo", "lst_sexo", ["Masculino", "Femenino"], ["docentes$p2", "egresados$p2"]),
  esc("lst_vacia", "lst_vacia", ["Único"], ["docentes$p99"]),
];

describe("escalasParaVariable", () => {
  it("elige la escala de la base de la variable, no la homónima de otra", () => {
    const { propia } = escalasParaVariable(LISTAS, "egresados$p4_recod");
    expect(propia?.escala_id).toBe("lst_p4_recod#2");
    // El control: la misma pregunta en otra base da la OTRA escala.
    expect(escalasParaVariable(LISTAS, "docentes$p4_recod").propia?.escala_id)
      .toBe("lst_p4_recod");
  });

  it("no repite la escala propia entre las otras", () => {
    const { propia, otras } = escalasParaVariable(LISTAS, "docentes$p10");
    expect(propia?.escala_id).toBe("lst_p10");
    expect(otras.map((l) => l.escala_id)).not.toContain("lst_p10");
  });

  it("sin variable devuelve todas las escalas y ninguna propia", () => {
    const { propia, otras } = escalasParaVariable(LISTAS, undefined);
    expect(propia).toBeNull();
    // `lst_vacia` cae por tener una sola categoría: no hay nada que reordenar.
    expect(otras.map((l) => l.escala_id)).toEqual([
      "lst_p4_recod", "lst_p4_recod#2", "lst_p10", "lst_p10#2", "lst_sexo",
    ]);
  });

  it("una variable que ninguna escala declara no inventa propia", () => {
    expect(escalasParaVariable(LISTAS, "docentes$inexistente").propia).toBeNull();
  });

  it("cae al nombre sin calificar sólo si ninguna calificada coincide", () => {
    const sinBase = [esc("lst_x", "lst_x", ["A", "B"], ["p7"])];
    expect(escalasParaVariable(sinBase, "docentes$p7").propia?.escala_id).toBe("lst_x");
  });

  it("un backend viejo sin `variables` no rompe ni inventa propia", () => {
    const viejas = LISTAS.map(({ variables: _omitido, ...l }) => l);
    const { propia, otras } = escalasParaVariable(viejas, "docentes$p4_recod");
    expect(propia).toBeNull();
    expect(otras).toHaveLength(5);
  });
});

// Con la escala de la pregunta resuelta, el campo ofrecía además las otras 22
// del estudio. Sembrar desde una de ellas escribe etiquetas que este gráfico no
// tiene: como las no listadas van al final en su orden original, el orden
// queda inerte — y aun así se guarda en el .pulso.
describe("qué escalas se ofrecen para sembrar el orden manual", () => {
  it("sólo la de la pregunta cuando se conoce", () => {
    const escalas = escalasParaVariable(LISTAS, "docentes$p4_recod");
    // El control: hay alternativas que ofrecer, y aun así no se ofrecen.
    expect(escalas.propia).not.toBeNull();
    expect(escalas.otras.length).toBeGreaterThan(0);
    expect(escalasParaSembrar(escalas)).toEqual([]);
  });

  it("todas cuando la de la pregunta no se resuelve", () => {
    // Sin este caso el campo quedaría vacío y sin forma de arrancar: una
    // variable sin escala declarada, o un cruce.
    const escalas = escalasParaVariable(LISTAS, "docentes$inexistente");
    expect(escalas.propia).toBeNull();
    expect(escalasParaSembrar(escalas)).toEqual(escalas.otras);
    expect(escalasParaSembrar(escalas).length).toBeGreaterThan(0);
  });

  it("todas cuando no hay variable elegida todavía", () => {
    const escalas = escalasParaVariable(LISTAS, undefined);
    expect(escalasParaSembrar(escalas)).toEqual(escalas.otras);
  });
});
