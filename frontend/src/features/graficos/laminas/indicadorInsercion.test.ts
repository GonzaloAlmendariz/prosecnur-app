// R5-7: el destino del arrastre se marca en la fila de destino, sin desplazar las vecinas.
import { describe, expect, it } from "vitest";
import { ladoInsercion, sinDesplazar } from "./indicadorInsercion";

describe("ladoInsercion", () => {
  it("al subir, la lámina entra antes de la fila de destino; al bajar, después", () => {
    expect(ladoInsercion(2, 5, 2)).toBe("antes");
    expect(ladoInsercion(5, 2, 5)).toBe("despues");
  });

  it("sólo la fila de destino lo marca, nunca la tomada ni sin arrastre", () => {
    expect(ladoInsercion(3, 5, 2)).toBeNull();
    expect(ladoInsercion(2, 2, 2)).toBeNull();
    expect(ladoInsercion(2, -1, -1)).toBeNull();
  });

  it("las vecinas no se desplazan", () => {
    const rect = { top: 0, left: 0, width: 10, height: 10, right: 10, bottom: 10 };
    expect(sinDesplazar({ rects: [rect, rect], activeNodeRect: rect, activeIndex: 0, overIndex: 1, index: 1 })).toBeNull();
  });
});
