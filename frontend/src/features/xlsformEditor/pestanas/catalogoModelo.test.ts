import { describe, expect, test } from "vitest";
import { buscarFunciones, fragmentoDe, FUNCIONES, insertarEnCursor } from "./catalogoModelo";

describe("catálogo de funciones", () => {
  test("busca por palabras parciales y sueltas", () => {
    expect(buscarFunciones("date time").map((f) => f.id)).toContain("decimal-date-time");
    expect(buscarFunciones("indexed").map((f) => f.id)).toEqual(["indexed-repeat"]);
    expect(buscarFunciones("repetid").length).toBeGreaterThan(3);
    expect(buscarFunciones("  ").length).toBe(FUNCIONES.length);
  });

  test("inserta en el cursor y deja el cursor dentro de los paréntesis", () => {
    const f = FUNCIONES.find((x) => x.id === "round")!;
    const r = insertarEnCursor("${a} + ", 7, 7, fragmentoDe(f));
    expect(r.texto).toBe("${a} + round()");
    expect(r.cursor).toBe(13);
    const hoy = FUNCIONES.find((x) => x.id === "today")!;
    expect(insertarEnCursor("xx", 1, 2, fragmentoDe(hoy))).toEqual({ texto: "xtoday()", cursor: 8 });
  });
});
