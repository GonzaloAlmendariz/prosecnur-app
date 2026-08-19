import { describe, expect, it } from "vitest";

import { bindingLabel, materialFieldBinding, materialFieldCanvasLabel } from "./MaterialsSection";

describe("campos semánticos del material", () => {
  it("conserva el binding técnico para el payload, pero lo traduce al mostrarlo", () => {
    expect(materialFieldBinding("unit.schedule")).toBe("unit.schedule");
    expect(materialFieldCanvasLabel("unit.schedule")).toBe("Horario");
  });

  it("presenta campos etiquetados del preset sin [object Object]", () => {
    const field = { label: "Horario", binding: "unit.schedule" };
    expect(materialFieldBinding(field)).toBe("unit.schedule");
    expect(materialFieldCanvasLabel(field)).toBe("Horario");
  });

  it("no deja un binding sin traducir en la UI del editor", () => {
    expect(bindingLabel("unit.venue")).toBe("Aula o lugar");
    expect(bindingLabel("deployment.deployment_id")).toBe("Código de la entrega");
    // Un binding desconocido (fixture vieja, dato no mapeado) cae al valor
    // crudo en vez de romper — mejor mostrar algo técnico que nada.
    expect(bindingLabel("algo.no_mapeado")).toBe("algo.no_mapeado");
  });
});
