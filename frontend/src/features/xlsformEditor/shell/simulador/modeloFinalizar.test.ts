// Mata: finalizar con obligatorias vacías, no avisar una edad fuera de rango o inventar un rechazo que no se evalúa.
import { describe, expect, it } from "vitest";
import type { BuilderNode } from "../../types";
import { MENSAJE_REGLA_POR_DEFECTO, pendientesParaFinalizar, restriccionIncumplida } from "./modeloFinalizar";

const n = (name: string, extra: Partial<BuilderNode> = {}) =>
  ({ name, rowIndex: 1, label: `¿${name}?`, required: false, constraint: "", relevant: "", calculation: "", choiceFilter: "", paperNumber: "", typeInfo: { raw: "integer", base: "integer", listName: "" }, ...extra }) as BuilderNode;

describe("restricciones en Probar", () => {
  const edad = n("p2", { constraint: ". >= 18 and . <= 100" });
  it("una edad fuera de rango se rechaza con el mensaje por defecto o el de la regla", () => {
    expect(restriccionIncumplida(edad, "150", {})).toBe(MENSAJE_REGLA_POR_DEFECTO);
    expect(restriccionIncumplida({ ...edad, constraint_message: "Edad fuera de rango." }, "10", {})).toBe("Edad fuera de rango.");
    expect(restriccionIncumplida(edad, "40", {})).toBeNull();
  });
  it("vacío o no evaluable no se rechaza", () => {
    expect(restriccionIncumplida(edad, "", {})).toBeNull();
    expect(restriccionIncumplida(n("x", { constraint: "funcion_rara(.)" }), "1", {})).toBeNull();
  });
  it("select_multiple se evalúa con sus códigos", () => {
    expect(restriccionIncumplida(n("m", { constraint: "count-selected(.) <= 2" }), ["1", "2", "3"], {})).not.toBeNull();
  });
});

describe("finalizar", () => {
  it("lista obligatorias visibles sin respuesta y reglas incumplidas, con su página", () => {
    const p = [{ nodes: [n("a", { required: true }), n("b", { required: true })] }, { nodes: [n("c", { constraint: ". < 5" }), n("d", { required: true })] }];
    const r = pendientesParaFinalizar(p, () => true, (x) => x.name !== "b", { c: "9" });
    expect(r.map((x) => [x.name, x.pagina, x.motivo])).toEqual([["a", 0, "falta"], ["c", 1, "regla"], ["d", 1, "falta"]]);
  });
});
