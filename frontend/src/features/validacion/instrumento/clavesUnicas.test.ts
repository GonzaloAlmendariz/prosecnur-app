import { describe, expect, it } from "vitest";

import { clavesUnicas } from "./GruposDeReglas";

// QA dentro de la app de V2: en acnur_pdm el resumen de la auditoría trae dos
// filas con `VR_skip_[documento]` y React avisaba de claves repetidas.
describe("clavesUnicas", () => {
  it("da una clave distinta a cada fila aunque el id se repita", () => {
    const filas = [{ id: "VR_skip_[documento]" }, { id: "R_1" }, { id: "VR_skip_[documento]" }];
    const claves = clavesUnicas(filas).map(([clave]) => clave);
    expect(new Set(claves).size).toBe(filas.length);
    expect(claves).toEqual(["VR_skip_[documento]", "R_1", "VR_skip_[documento]#2"]);
  });

  it("sin repetidos la clave es el id, como antes", () => {
    expect(clavesUnicas([{ id: "a" }, { id: "b" }]).map(([c]) => c)).toEqual(["a", "b"]);
  });
});
