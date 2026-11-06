import { describe, expect, test } from "vitest";
import cobertura from "../../limaDistrictCoverage.json";
import { contornosDeCobertura } from "../lienzo/capas";
import { agregarVarios, alternar, alternarZona, cambios } from "./borrador";
import { distritoEnPunto, puntoEnAnillo } from "./puntoEnDistrito";
import { zonasDeLima } from "./zonasLima";

const contornos = contornosDeCobertura(cobertura as Parameters<typeof contornosDeCobertura>[0]);

describe("borrador de distritos", () => {
  test("alternar agrega al final y quita sin desordenar", () => {
    expect(alternar(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(alternar(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
  test("agregar varios no repite", () => {
    expect(agregarVarios(["a"], ["a", "b", "b", "c"])).toEqual(["a", "b", "c"]);
  });
  test("una zona completa se quita entera; incompleta, se completa", () => {
    expect(alternarZona(["x", "a"], ["a", "b"])).toEqual(["x", "a", "b"]);
    expect(alternarZona(["x", "a", "b"], ["a", "b"])).toEqual(["x"]);
  });
  test("los cambios dicen qué entra y qué sale", () => {
    expect(cambios(["a", "b"], ["b", "c"])).toEqual({ agrega: ["c"], quita: ["a"], pendiente: true });
    expect(cambios(["a"], ["a"]).pendiente).toBe(false);
  });
});

describe("zonas de Lima", () => {
  test("las seis zonas cubren los 50 distritos sin repetir", () => {
    const zonas = zonasDeLima(contornos);
    expect(zonas.map((z) => [z.id, z.ubigeos.length])).toEqual([["norte", 8], ["este", 7], ["sur", 11], ["centro", 5], ["moderna", 12], ["callao", 7]]);
    const todos = zonas.flatMap((z) => z.ubigeos);
    expect(new Set(todos).size).toBe(50);
  });
});

describe("distrito bajo un punto", () => {
  test("el cruce de rayos distingue dentro y fuera de un cuadrado", () => {
    const cuadrado = [0, 0, 10, 0, 10, 10, 0, 10, 0, 0];
    expect(puntoEnAnillo(5, 5, cuadrado)).toBe(true);
    expect(puntoEnAnillo(15, 5, cuadrado)).toBe(false);
  });
  test("el punto de rótulo de cada distrito cae dentro de su propio contorno o de ninguno ajeno", () => {
    const ate = contornos.find((c) => c.ubigeo === "150103");
    expect(ate).toBeTruthy();
    if (!ate) return;
    expect(distritoEnPunto(contornos, ate.rotulo[0], ate.rotulo[1])?.ubigeo).toBe("150103");
    expect(distritoEnPunto(contornos, 1e7, 1e7)).toBeNull();
  });
});
