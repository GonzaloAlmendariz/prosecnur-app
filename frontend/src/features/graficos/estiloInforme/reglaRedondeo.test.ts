// R2 (2026-10-15). Mata: una regla general que no es la de la mayoría, o un conteo de «con regla propia» que cuenta el
// método de un tipo que no suma 100 % (siempre usa redondeo estándar).
import { describe, expect, it } from "vitest";
import { reglaGeneral } from "./reglaRedondeo";
import type { FilaCalculo } from "./modeloEstiloInforme";

const f = (preset: string, metodo: string, decimales: number, admiteMetodo = true): FilaCalculo =>
  ({ preset, titulo: preset, icono: "", admiteMetodo, campoDecimales: "decimales", metodo, metodoDefault: "estandar", choicesMetodo: [], decimales, decimalesDefault: 0, procedencia: "recetario" });

describe("regla general de redondeo", () => {
  it("es la de la mayoría y los que se apartan tienen regla propia", () => {
    const r = reglaGeneral([f("apiladas", "estandar", 0), f("multi", "estandar", 0), f("pie", "reparto", 0), f("radar", "estandar", 1, false)]);
    expect(r.metodo).toBe("estandar");
    expect(r.decimales).toBe(0);
    expect(r.conReglaPropia).toEqual(["pie", "radar"]);
  });

  it("un tipo que no suma 100 % no cuenta por su método", () => {
    expect(reglaGeneral([f("a", "reparto", 0), f("brecha", "estandar", 0, false)]).conReglaPropia).toEqual([]);
  });
});
