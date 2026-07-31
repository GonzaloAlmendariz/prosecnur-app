import { describe, expect, it } from "vitest";

import { criteriosDesdeFiltro, filtroDesdeCriterios, resumenDeCriterios } from "./criterios";

describe("criteriosDesdeFiltro", () => {
  it("lee el filtro de un solo criterio que ya existía", () => {
    expect(criteriosDesdeFiltro({ enabled: true, variable: "Intro/Consent", values: ["Yes"] }))
      .toEqual([{ variable: "Intro/Consent", values: ["Yes"], label: "Intro/Consent", value_label: "" }]);
  });

  it("suma los criterios de `filters` sin repetir el primero", () => {
    const criterios = criteriosDesdeFiltro({
      variable: "Intro/Consent",
      values: ["Yes"],
      filters: [
        { variable: "Intro/Consent", values: ["Yes"] },
        { variable: "Fin/Completo", values: ["Si"] },
      ],
    });
    expect(criterios.map((item) => item.variable)).toEqual(["Intro/Consent", "Fin/Completo"]);
  });

  it("descarta criterios sin variable o sin valores", () => {
    expect(criteriosDesdeFiltro({ variable: "", values: ["Yes"] })).toEqual([]);
    expect(criteriosDesdeFiltro({ variable: "P1", values: [] })).toEqual([]);
    expect(criteriosDesdeFiltro({ variable: "P1", values: ["  "] })).toEqual([]);
  });

  it("tolera un `filters` que llega como objeto suelto", () => {
    // `jsonlite` entrega así una lista de un solo elemento; sin esta puerta se
    // iterarían sus campos como si cada uno fuera un criterio.
    const criterios = criteriosDesdeFiltro({ filters: { variable: "P1", values: ["A"] } });
    expect(criterios).toHaveLength(1);
    expect(criterios[0].variable).toBe("P1");
  });

  it("no revienta con basura", () => {
    expect(criteriosDesdeFiltro(null)).toEqual([]);
    expect(criteriosDesdeFiltro("no")).toEqual([]);
    expect(criteriosDesdeFiltro({ filters: "no" })).toEqual([]);
  });
});

describe("filtroDesdeCriterios", () => {
  it("emite el par suelto y la lista, coherentes", () => {
    // Es lo que sostiene la compatibilidad: quien solo lee `variable`/`values`
    // sigue leyendo el primer criterio y no un filtro vacío.
    const filtro = filtroDesdeCriterios([
      { variable: "Intro/Consent", values: ["Yes"] },
      { variable: "Fin/Completo", values: ["Si"] },
    ]);

    expect(filtro.variable).toBe("Intro/Consent");
    expect(filtro.values).toEqual(["Yes"]);
    expect(filtro.filters).toHaveLength(2);
    expect(filtro.enabled).toBe(true);
  });

  it("sin criterios válidos el filtro queda apagado", () => {
    const filtro = filtroDesdeCriterios([{ variable: "", values: [] }]);
    expect(filtro.enabled).toBe(false);
    expect(filtro.variable).toBe("");
    expect(filtro.filters).toEqual([]);
  });

  it("da la vuelta completa sin perder nada", () => {
    const original = [
      { variable: "Intro/Consent", values: ["Yes", "Sí"], label: "Consentimiento", value_label: "Yes" },
      { variable: "Fin/Completo", values: ["Si"], label: "Fin/Completo", value_label: "" },
    ];
    expect(criteriosDesdeFiltro(filtroDesdeCriterios(original))).toEqual(original);
  });
});

describe("resumenDeCriterios", () => {
  it("dice cuántas condiciones hay que cumplir", () => {
    expect(resumenDeCriterios([])).toBe("Sin definir");
    expect(resumenDeCriterios([{ variable: "a", values: ["1"] }])).toBe("1 criterio");
    expect(resumenDeCriterios([
      { variable: "a", values: ["1"] },
      { variable: "b", values: ["2"] },
    ])).toBe("2 criterios");
  });
});
