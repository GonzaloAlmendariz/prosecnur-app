import { describe, expect, it } from "vitest";

import { sinCorteEnGuion } from "../sinCorteEnGuion";

describe("sinCorteEnGuion", () => {
  it("el guion entre letras no corta; el de una cifra o un código se queda", () => {
    expect(sinCorteEnGuion("por curso-horario")).toBe("por curso‑horario");
    expect(sinCorteEnGuion("2025-2")).toBe("2025-2");
    expect(sinCorteEnGuion("P2-P1")).toBe("P2-P1");
  });
});
