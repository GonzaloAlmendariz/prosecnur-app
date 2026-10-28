import { describe, expect, test } from "vitest";
import { focoDeVistaEstructura, vistaEstructuraDesdeFoco } from "./CargaStructureWorkbench";

describe("Carga › Estructura: la vista viaja en el foco (L19)", () => {
  test("Preguntas se escribe; Secciones es la de siempre y no ensucia la dirección", () => {
    expect(focoDeVistaEstructura("questions")).toBe("preguntas");
    expect(focoDeVistaEstructura("sections")).toBeNull();
  });

  test("cualquier otro foco, o ninguno, abre Secciones", () => {
    expect(vistaEstructuraDesdeFoco("preguntas")).toBe("questions");
    expect(vistaEstructuraDesdeFoco(null)).toBe("sections");
    expect(vistaEstructuraDesdeFoco("base-2")).toBe("sections");
  });
});
