import { describe, expect, it } from "vitest";
import { delMapaPorFacultad } from "./delMapaPorFacultad";

describe("delMapaPorFacultad", () => {
  const mapa = { "PSICOLOGÍA": { aulas: 6 }, "DERECHO": { aulas: 12 } };

  it("encuentra por el nombre tal cual", () => {
    expect(delMapaPorFacultad(mapa, "PSICOLOGÍA")?.aulas).toBe(6);
  });

  it("encuentra aunque la tilde venga descompuesta", () => {
    // «PSICOLOGÍA» con la Í como I + U+0301. Es lo que se ve al comparar un
    // nombre que viene de R con el que escribe el selector.
    const descompuesto = "PSICOLOGÍA".normalize("NFD");
    expect(descompuesto).not.toBe("PSICOLOGÍA");
    expect(delMapaPorFacultad(mapa, descompuesto)?.aulas).toBe(6);
  });

  it("no distingue mayúsculas ni espacios de sobra", () => {
    expect(delMapaPorFacultad(mapa, " psicología ")?.aulas).toBe(6);
  });

  it("devuelve null cuando la facultad no está, sin caer en otra", () => {
    expect(delMapaPorFacultad(mapa, "ARQUITECTURA")).toBeNull();
    expect(delMapaPorFacultad(mapa, undefined)).toBeNull();
    expect(delMapaPorFacultad(null, "DERECHO")).toBeNull();
  });

  it("una entrada con valor falsy se devuelve, no se confunde con ausente", () => {
    expect(delMapaPorFacultad({ "DERECHO": 0 }, "derecho")).toBe(0);
  });
});
