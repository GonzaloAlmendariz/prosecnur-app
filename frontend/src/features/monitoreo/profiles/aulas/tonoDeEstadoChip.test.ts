import { describe, expect, it } from "vitest";

import { tonoDeEstadoChip } from "./tonoDeEstadoChip";

describe("tonoDeEstadoChip", () => {
  it("traduce el tono del modelo por el color que pintaba el chip propio", () => {
    expect(tonoDeEstadoChip("ok")).toBe("success");
    expect(tonoDeEstadoChip("aviso")).toBe("warn");
    expect(tonoDeEstadoChip("riesgo")).toBe("danger");
    expect(tonoDeEstadoChip("falla")).toBe("danger");
    expect(tonoDeEstadoChip("info")).toBe("info");
    expect(tonoDeEstadoChip("neutro")).toBe("neutral");
  });
});
