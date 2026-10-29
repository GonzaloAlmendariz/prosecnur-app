import { describe, expect, it } from "vitest";
import type { HojasRutaCoberturaMarco } from "../../../../api/hojasRuta";
import { proyectarLonLat } from "../lienzo/camara";
import { aLonLat, cerrarAnillo, cierraEnPrimero, faltaEnArea, nuevaArea, tonoCobertura } from "./marcoElegible";

const cobertura = (c: number | null) => ({ cobertura_poblacion: c }) as HojasRutaCoberturaMarco;

describe("marco elegible en el lienzo", () => {
  it("del mundo a lon/lat es la inversa de la proyección del lienzo, a 1e-5 (1 m)", () => {
    const [x, y] = proyectarLonLat(-77.0123, -12.0456);
    const [lon, lat] = aLonLat(x, y);
    expect(lon).toBeCloseTo(-77.0123, 5);
    expect(lat).toBeCloseTo(-12.0456, 5);
  });

  it("el anillo se cierra una sola vez y pide tres vértices", () => {
    expect(cerrarAnillo([[0, 0], [1, 0]])).toEqual([]);
    expect(cerrarAnillo([[0, 0], [1, 0], [1, 1]])).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]]);
    expect(cerrarAnillo([[0, 0], [1, 0], [1, 1], [0, 0]])).toHaveLength(4);
  });

  it("pide lo mismo que el normalizador de R: detalle con «otro», fuente y fecha con inseguridad", () => {
    const v: [number, number][] = [[0, 0], [1, 0], [1, 1]];
    expect(faltaEnArea({ motivo: "otro", detalle: " ", fuente: "", fecha: "" }, v)).toMatch(/detalle/);
    expect(faltaEnArea({ motivo: "inseguridad", detalle: "", fuente: "Supervisión", fecha: "" }, v)).toMatch(/fuente/);
    expect(faltaEnArea({ motivo: "no_residencial", detalle: "", fuente: "", fecha: "" }, v)).toBeNull();
    expect(faltaEnArea({ motivo: "no_residencial", detalle: "", fuente: "", fecha: "" }, v.slice(0, 2))).toMatch(/tres puntos/);
  });

  it("un área nueva toma un id libre y guarda el anillo cerrado", () => {
    const a = nuevaArea({ motivo: "no_residencial", detalle: " Fábricas ", fuente: "", fecha: "" }, [[0, 0], [1, 0], [1, 1]], [{ id: "area-1" } as never, { id: "area-2" } as never], new Date(0));
    expect(a.id).toBe("area-3");
    expect(a.detalle).toBe("Fábricas");
    expect(a.poligono).toHaveLength(4);
    expect(a.fuente).toBeUndefined();
  });

  it("la cobertura se tiñe: ámbar sobre 5 %, decisión desde 10 %, sin población no avisa", () => {
    expect(tonoCobertura(cobertura(0.97))).toBe("ok");
    expect(tonoCobertura(cobertura(0.95))).toBe("ok");
    expect(tonoCobertura(cobertura(0.94))).toBe("ambar");
    expect(tonoCobertura(cobertura(0.9))).toBe("decision");
    expect(tonoCobertura(cobertura(null))).toBe("ok");
  });

  it("un clic cerca del primer vértice cierra el área", () => {
    const v: [number, number][] = [[0, 0], [100, 0], [100, 100]];
    expect(cierraEnPrimero(v, [5, 5], 10)).toBe(true);
    expect(cierraEnPrimero(v, [50, 50], 10)).toBe(false);
    expect(cierraEnPrimero(v.slice(0, 2), [0, 0], 10)).toBe(false);
  });
});
