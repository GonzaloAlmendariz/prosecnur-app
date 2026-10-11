import { describe, expect, it } from "vitest";
import { filasEditables } from "./FilasFichaTecnica";

describe("filasEditables (QA qa-f6-4: no se podían teclear espacios)", () => {
  it("conserva los espacios de una fila que se está escribiendo", () => {
    expect(filasEditables([{ criterio: "Margen de ", detalle: "Más o menos " }]))
      .toEqual([{ criterio: "Margen de ", detalle: "Más o menos " }]);
  });
  it("el texto viejo sigue separándose en filas", () => {
    expect(filasEditables("Muestra: 400").length).toBe(1);
  });
});
