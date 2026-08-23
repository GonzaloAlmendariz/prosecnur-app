import { describe, expect, it } from "vitest";

import { bindingLabel, cuentaDeFichas, materialFieldBinding, materialFieldCanvasLabel } from "./MaterialsSection";

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

describe("cuántas fichas hay, de cuántas hacen falta", () => {
  it("ancla la cuenta al plan", () => {
    // Medido el 2026-08-23: el panel decía «Fichas 0» sobre un plan de 193
    // aulas. Un cero sin denominador no dice si falta todo o si no hay nada
    // que hacer.
    expect(cuentaDeFichas(0, 193)).toBe("0 de 193");
    expect(cuentaDeFichas(193, 193)).toBe("193 de 193");
  });

  it("no inventa un denominador cuando no hay plan", () => {
    // «0 de 0» promete una comparación que no se puede hacer.
    expect(cuentaDeFichas(0, 0)).toBe("0");
    expect(cuentaDeFichas(4, 0)).toBe("4");
  });

  it("separa los miles, como el resto de la pantalla", () => {
    expect(cuentaDeFichas(1200, 2616)).toBe("1,200 de 2,616");
  });
});
