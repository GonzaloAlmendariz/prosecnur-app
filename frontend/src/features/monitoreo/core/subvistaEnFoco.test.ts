import { describe, expect, it } from "vitest";
import { focoDeSubvista, subvistaDesdeFoco } from "./subvistaEnFoco";

// L19: la sub-vista de una pestaña viaja en el foco; la de siempre no se escribe.
const VISTAS = ["tiempo", "muestra", "prioridad"] as const;

describe("sub-vista en el foco", () => {
  it("lee la vista del foco y cae en la de siempre con cualquier otro foco o ninguno", () => {
    expect(subvistaDesdeFoco("muestra", VISTAS, "tiempo")).toBe("muestra");
    expect(subvistaDesdeFoco(null, VISTAS, "tiempo")).toBe("tiempo");
    expect(subvistaDesdeFoco("aula:CH 1", VISTAS, "tiempo")).toBe("tiempo");
  });

  it("la vista por defecto no se escribe; las demás sí (ida y vuelta)", () => {
    expect(focoDeSubvista("tiempo", "tiempo")).toBeNull();
    for (const vista of VISTAS) {
      expect(subvistaDesdeFoco(focoDeSubvista(vista, "tiempo"), VISTAS, "tiempo")).toBe(vista);
    }
  });
});
