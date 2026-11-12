import { describe, expect, it } from "vitest";

import { rotuloDeCaso } from "./rotuloDeCaso";

describe("rotuloDeCaso", () => {
  it("un caso identificado por número de fila se nombra por su fila, con el id interno en el título", () => {
    expect(rotuloDeCaso("principal::idx::482")).toEqual({
      texto: "Fila 482",
      titulo: "Fila 482 de los datos, sin contar la cabecera. Identificador interno: principal::idx::482",
    });
    expect(rotuloDeCaso("principal::row::7").texto).toBe("Fila 7");
  });

  it("en un grupo repetido nombra la tabla", () => {
    expect(rotuloDeCaso("hijos::idx::3").texto).toBe("Fila 3 de hijos");
  });

  it("un identificador real de la base se muestra tal cual", () => {
    expect(rotuloDeCaso("uuid-123")).toEqual({ texto: "uuid-123", titulo: "uuid-123" });
  });
});
