import { describe, expect, test } from "vitest";
import { evaluarCalculo } from "./probarCalculo";

const D = "$";
describe("probar un cálculo", () => {
  test("suma, producto y división con precedencia", () => {
    expect(evaluarCalculo(`${D}{a} + ${D}{b} * 2`, { a: "1", b: "3" })).toEqual({ estado: "ok", valor: "7" });
    expect(evaluarCalculo(`(${D}{a} + ${D}{b}) div 2`, { a: "1", b: "3" })).toEqual({ estado: "ok", valor: "2" });
  });
  test("coalesce cubre la respuesta vacía", () => {
    expect(evaluarCalculo(`coalesce(${D}{m}, 0) * 12 + coalesce(${D}{n}, 0)`, { m: "2", n: "" })).toEqual({ estado: "ok", valor: "24" });
  });
  test("if con comparación usa el evaluador estructurado", () => {
    expect(evaluarCalculo(`if(${D}{edad} < 25, 'joven', 'adulto')`, { edad: "30" })).toEqual({ estado: "ok", valor: "adulto" });
  });
  test("lo que no es aritmética simple no se inventa", () => {
    expect(evaluarCalculo(`pulldata('t', 'a', 'b', ${D}{x})`, { x: "1" }).estado).toBe("no-evaluable");
    expect(evaluarCalculo(`indexed-repeat(${D}{n}, ${D}{r}, position(..))`, {}).estado).toBe("no-evaluable");
  });
});
