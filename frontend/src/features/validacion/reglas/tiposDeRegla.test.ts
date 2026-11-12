import { describe, expect, it } from "vitest";

import { tiposDelGrupo } from "./tiposDeRegla";

describe("tiposDelGrupo", () => {
  it("ofrece Respuesta obligatoria y Respuesta fuera de lista para crear una regla", () => {
    const claves = tiposDelGrupo("respuesta", null).map((t) => t.key);
    expect(claves).toContain("no_nulo");
    expect(claves).toContain("fuera_catalogo");
  });

  it("los valores extremos siguen ocultos salvo en la regla que ya es de ese tipo", () => {
    expect(tiposDelGrupo("respuesta", null).map((t) => t.key)).not.toContain("outliers_iqr");
    expect(tiposDelGrupo("respuesta", "outliers_iqr").map((t) => t.key)).toContain("outliers_iqr");
  });
});
