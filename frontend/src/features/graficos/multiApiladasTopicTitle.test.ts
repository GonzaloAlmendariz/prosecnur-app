import { describe, expect, it } from "vitest";
import { _isDefaultTopicTitle as isDefaultTopicTitle } from "./MultiApiladasBuilder";

// El título del tema es la columna izquierda del gráfico comparativo: si
// queda en su marcador de posición, la lámina sale rotulada "Tema 1".
describe("isDefaultTopicTitle", () => {
  it("reconoce el marcador de posición y el vacío", () => {
    expect(isDefaultTopicTitle("Tema 1", 0)).toBe(true);
    expect(isDefaultTopicTitle("Tema 3", 2)).toBe(true);
    expect(isDefaultTopicTitle("", 0)).toBe(true);
    expect(isDefaultTopicTitle("   ", 1)).toBe(true);
  });

  it("respeta lo que el analista escribió, incluso si se parece", () => {
    expect(isDefaultTopicTitle("Actividades culturales", 0)).toBe(false);
    // "Tema 2" en la posición 0 es un título elegido, no el default de esa fila.
    expect(isDefaultTopicTitle("Tema 2", 0)).toBe(false);
  });
});
