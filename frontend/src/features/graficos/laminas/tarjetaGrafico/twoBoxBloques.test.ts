import { describe, expect, it } from "vitest";
import { bloquesSinCategorias, conTopEnBloques, topDeBloques } from "./TwoBoxGrafico";

describe("Top Two Box de una multilista desde la tarjeta", () => {
  const bloques = [{ vars: { t: ["a$p1"] }, top2box: true, top2box_labels: ["De acuerdo", "Muy de acuerdo"] }, { vars: { t: ["a$p2"] } }];

  it("dice si la llevan todos, algunos o ninguno de los bloques", () => {
    expect(topDeBloques(bloques)).toBe("algunos");
    expect(topDeBloques(conTopEnBloques(bloques, true))).toBe("todos");
    expect(topDeBloques(conTopEnBloques(bloques, false))).toBe("ninguno");
    expect(topDeBloques(undefined)).toBe("ninguno");
  });

  it("encender en todos conserva preguntas y categorías, y cuenta los bloques sin categorías", () => {
    const todos = conTopEnBloques(bloques, true) as Record<string, unknown>[];
    expect(todos[0]).toMatchObject({ vars: { t: ["a$p1"] }, top2box_labels: ["De acuerdo", "Muy de acuerdo"] });
    expect(bloquesSinCategorias(todos)).toBe(1);
  });
});
