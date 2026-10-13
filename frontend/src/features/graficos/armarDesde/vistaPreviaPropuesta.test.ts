import { describe, expect, test } from "vitest";
import { contenidoPropuesto, textoFueraDelMazo, tituloPropuesto } from "./vistaPreviaPropuesta";

describe("vista previa de Armar desde", () => {
  test("los motivos de lo que queda fuera se dicen en palabras, con su número", () => {
    expect(textoFueraDelMazo([{ motivo: "no_graficable" }])).toBe("Fuera del mazo: 1 pregunta numérica, que necesita tramos.");
    const texto = textoFueraDelMazo([{ motivo: "sin_diapositiva" }, { motivo: "sin_diapositiva" }, { motivo: "raro" }]);
    expect(texto).toBe("Fuera del mazo: 2 temas sin diapositiva asignada; 1 tema que no entra.");
    expect(texto).not.toMatch(/_/);
    expect(textoFueraDelMazo([])).toBe("");
  });

  test("una lámina sin enunciado no se titula con su tipo interno", () => {
    expect(tituloPropuesto("", true)).toBe("Sin título: escribe su enunciado en Carga › Equivalencias");
    expect(tituloPropuesto(undefined, false)).toBe("Sin título");
    expect(tituloPropuesto("  ¿Cuál es su género? ", true)).toBe("¿Cuál es su género?");
  });

  test("bajo el título va lo que lleva la lámina, no su tipo", () => {
    expect(contenidoPropuesto("p_slide_1_grafico")).toBe("1 gráfico");
    expect(contenidoPropuesto("p_slide_1_grafico")).not.toContain("p_slide");
  });
});

describe("sin título escrito, la vista previa dice el que va a salir (Gonzalo, 2026-10-13)", () => {
  test("usa el título inferido de la pregunta antes que «Sin título»", () => {
    expect(tituloPropuesto("", false, "¿Conoce la misión de la PUCP?")).toBe("¿Conoce la misión de la PUCP?");
    expect(tituloPropuesto("", false, "")).toBe("Sin título");
    expect(tituloPropuesto("Escrito", false, "Inferido")).toBe("Escrito");
  });
});
