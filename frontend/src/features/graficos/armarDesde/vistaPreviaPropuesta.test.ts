import { describe, expect, test } from "vitest";
import { contenidoPropuesto, tituloPropuesto } from "./vistaPreviaPropuesta";

describe("vista previa de Armar desde", () => {
  test("una lámina sin enunciado no se titula con su tipo interno", () => {
    expect(tituloPropuesto("")).toBe("Sin título");
    expect(tituloPropuesto(undefined)).toBe("Sin título");
    expect(tituloPropuesto("  ¿Cuál es su género? ")).toBe("¿Cuál es su género?");
  });

  test("bajo el título va lo que lleva la lámina, no su tipo", () => {
    expect(contenidoPropuesto("p_slide_1_grafico")).toBe("1 gráfico");
    expect(contenidoPropuesto("p_slide_1_grafico")).not.toContain("p_slide");
  });
});

describe("sin título escrito, la vista previa dice el que va a salir (Gonzalo, 2026-10-13)", () => {
  test("usa el título inferido de la pregunta antes que «Sin título»", () => {
    expect(tituloPropuesto("", "¿Conoce la misión de la PUCP?")).toBe("¿Conoce la misión de la PUCP?");
    expect(tituloPropuesto("", "")).toBe("Sin título");
    expect(tituloPropuesto("Escrito", "Inferido")).toBe("Escrito");
  });
});
