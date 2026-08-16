import { describe, expect, it } from "vitest";

import { describirExclusionesPreservadas } from "./LimpiezaTab";

describe("describirExclusionesPreservadas", () => {
  it("calla cuando no hay nada en cuarentena", () => {
    expect(describirExclusionesPreservadas(undefined)).toBeNull();
    expect(describirExclusionesPreservadas({ n: 0, n_casos: 0 })).toBeNull();
    // Un payload viejo sin la clave no debe inventar un aviso.
    expect(describirExclusionesPreservadas({ n: NaN, n_casos: 3 } as never)).toBeNull();
  });

  it("dice cuántas son, sobre cuántos casos y qué falta para recuperarlas", () => {
    const texto = describirExclusionesPreservadas({ n: 2, n_casos: 3 });
    expect(texto).toContain("2 exclusiones");
    expect(texto).toContain("3 casos");
    expect(texto).toContain("auditoría");
  });

  it("concuerda en singular", () => {
    const texto = describirExclusionesPreservadas({ n: 1, n_casos: 1 });
    expect(texto).toContain("1 exclusión ");
    expect(texto).toContain("(1 caso)");
    expect(texto).not.toContain("exclusiones");
  });
});
