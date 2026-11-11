import { describe, expect, it } from "vitest";
import { BASE_UNICA, baseDeVariables } from "./contextoDeCarga";

const VARIAS = {
  esVarias: true,
  hayRespuestas: true,
  bases: ["hogares", "miembros", "docentes"],
  basesPrimarias: ["hogares", "docentes"],
  baseActiva: "docentes",
};

describe("base de la pestaña Variables", () => {
  it("con una base es la base única, y nada mientras no hay respuestas", () => {
    expect(baseDeVariables({ ...VARIAS, esVarias: false, foco: "otra" })).toBe(BASE_UNICA);
    expect(baseDeVariables({ ...VARIAS, esVarias: false, hayRespuestas: false, foco: null })).toBe("");
  });

  it("con varias manda el foco de la dirección, también si es una base hija", () => {
    expect(baseDeVariables({ ...VARIAS, foco: "hogares" })).toBe("hogares");
    expect(baseDeVariables({ ...VARIAS, foco: "miembros" })).toBe("miembros");
  });

  it("un foco que no es una base cae en la activa y, sin activa válida, en la primera primaria", () => {
    expect(baseDeVariables({ ...VARIAS, foco: "inexistente" })).toBe("docentes");
    expect(baseDeVariables({ ...VARIAS, foco: null, baseActiva: "miembros" })).toBe("hogares");
    expect(baseDeVariables({ ...VARIAS, foco: null, bases: [], basesPrimarias: [], baseActiva: null })).toBe("");
  });
});
