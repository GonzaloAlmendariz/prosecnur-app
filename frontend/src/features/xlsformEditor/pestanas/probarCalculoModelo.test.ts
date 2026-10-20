import { describe, expect, test } from "vitest";
import { ejemploPorTipo, valoresDePrueba } from "./probarCalculoModelo";

describe("valores de prueba de un cálculo", () => {
  test("un cálculo o una variable sin tipo recibe un número, no «ejemplo»", () => {
    expect(ejemploPorTipo("calculate", [])).toBe("3");
    expect(ejemploPorTipo("", [])).toBe("3");
    expect(ejemploPorTipo("text", [])).toBe("ejemplo");
  });

  test("lo tecleado se conserva aunque la estructura cambie al guardar", () => {
    const tipo = () => ({ base: "integer", opciones: [] });
    const antes = valoresDePrueba(["a", "b"], { a: "12" }, tipo);
    expect(antes).toEqual({ a: "12", b: "3" });
    // Tras guardar, el borrador agrega una variable nueva: la tecleada sigue igual.
    expect(valoresDePrueba(["a", "b", "c"], { a: "12" }, tipo)).toEqual({ a: "12", b: "3", c: "3" });
  });
});
