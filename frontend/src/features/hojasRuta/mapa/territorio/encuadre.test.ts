import { describe, expect, it } from "vitest";
import type { ContornoDistrito } from "../lienzo/capas";
import { cajaDeTerritorio, ciudadEnFoco, enLimaCallao } from "./encuadre";

const c = (ubigeo: string, caja: [number, number, number, number]): ContornoDistrito =>
  ({ ubigeo, nombre: ubigeo, provincia: "", anillos: [], caja, rotulo: [0, 0] }) as unknown as ContornoDistrito;

const contornos = [
  c("150101", [0, 0, 10, 10]),
  c("150122", [10, 0, 20, 10]),
  c("070101", [-10, 0, 0, 10]),
  c("040101", [500, 900, 510, 910]),
  c("040104", [510, 900, 530, 920]),
  c("130101", [-300, -600, -290, -590]),
];

describe("encuadre de Territorio", () => {
  it("sin nada elegido encuadra Lima y Callao, no el país", () => {
    expect(cajaDeTerritorio(contornos, [], [])).toEqual([-10, 0, 20, 10]);
  });
  it("con todo en Lima encuadra lo confirmado, aunque se marque otro distrito de Lima", () => {
    expect(cajaDeTerritorio(contornos, ["150101", "150122"], ["150101"])).toEqual([0, 0, 10, 10]);
  });
  it("un distrito de Arequipa lleva el mapa a toda la ciudad", () => {
    expect(cajaDeTerritorio(contornos, ["040101"], [])).toEqual([500, 900, 530, 920]);
  });
  it("con Lima y una ciudad encuadra la ciudad: las dos no caben en la cámara", () => {
    expect(cajaDeTerritorio(contornos, ["040104"], ["150101"])).toEqual([500, 900, 530, 920]);
  });
  it("con dos ciudades manda la del último distrito elegido", () => {
    expect(cajaDeTerritorio(contornos, ["040101", "130101"], [])).toEqual([-300, -600, -290, -590]);
    expect(ciudadEnFoco(["130101", "040104"], [])).toBe("0401");
    expect(ciudadEnFoco(["150101"], ["070101"])).toBeNull();
  });
  it("Callao cuenta como Lima", () => {
    expect(enLimaCallao("070101")).toBe(true);
    expect(enLimaCallao("130101")).toBe(false);
  });
});
