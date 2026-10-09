import { describe, expect, it } from "vitest";

import { fraseDelRetiro } from "./retiroDeLaDistribucion";

describe("lo que el sync retiró de la distribución", () => {
  it("dice cuántas filas y de qué aulas", () => {
    const f = fraseDelRetiro({ ok: true, retiradas: 3,
      filas: [{ codigo: "CH 7" }, { codigo: "CH 7" }, { codigo: "CH 42" }] });
    expect(f?.texto).toContain("dejó de listar 3 filas");
    expect(f?.texto).toContain("(CH 7, CH 42)");
    expect(f?.tono).toBe("ok");
  });
  it("sin nada retirado no dice nada; un fallo se dice con su causa", () => {
    expect(fraseDelRetiro({ ok: true, retiradas: 0 })).toBeNull();
    expect(fraseDelRetiro(null)).toBeNull();
    const e = fraseDelRetiro({ ok: false, retiradas: 0, mensaje: "403" });
    expect(e?.tono).toBe("atencion");
    expect(e?.texto).toContain("403");
  });
});
