import { describe, expect, it } from "vitest";
import type { LimiteNombrado } from "../lienzo/limites";
import { cajaDelAtlas, ciudadesDeDepartamento, claveNombre, departamentoEnPunto } from "./atlasFoco";
import type { CiudadAtlas } from "./ciudades";
import indice from "../../ciudadesIndice.json";

const ciudad = (codigo: string, departamento: string, caja: [number, number, number, number]) => ({ codigo, nombre: codigo, departamento, caja } as unknown as CiudadAtlas);
const atlas = [ciudad("2209", "San Martín", [10, 10, 20, 20]), ciudad("0401", "Arequipa", [100, 100, 110, 110]), ciudad("lima", "Lima Metropolitana y Callao", [50, 50, 60, 60])];
const dep = (nombre: string, caja: [number, number, number, number]): LimiteNombrado => ({ nombre, rotulo: [0, 0], caja, anillos: [[caja[0], caja[1], caja[2], caja[1], caja[2], caja[3], caja[0], caja[3]]] });
const departamentos = [dep("San Martín", [0, 0, 40, 40]), dep("Callao", [45, 45, 52, 52]), dep("Amazonas", [0, 41, 40, 80])];

describe("atlas por niveles", () => {
  it("compara departamentos sin tildes ni mayúsculas", () => {
    expect(claveNombre("Áncash")).toBe(claveNombre("ANCASH"));
    expect(ciudadesDeDepartamento(atlas, "SAN MARTIN").map((c) => c.codigo)).toEqual(["2209"]);
    expect(ciudadesDeDepartamento(atlas, "Callao").map((c) => c.codigo)).toEqual(["lima"]);
  });
  it("el clic encuentra el departamento por par-impar", () => {
    expect(departamentoEnPunto(departamentos, 5, 5)?.nombre).toBe("San Martín");
    expect(departamentoEnPunto(departamentos, 500, 500)).toBeNull();
  });
  it("encuadre: ciudad → sus distritos o su silueta; departamento → sus ciudades o él mismo; nada → país", () => {
    const pais: [number, number, number, number] = [0, 0, 200, 200];
    const base = { atlas, departamentos, pais, departamento: null, ciudad: null, distritosCiudad: [] };
    expect(cajaDelAtlas(base)).toEqual(pais);
    expect(cajaDelAtlas({ ...base, departamento: "San Martín" })).toEqual([0, 0, 40, 40]);
    expect(cajaDelAtlas({ ...base, departamento: "Callao" })).toEqual([45, 45, 60, 60]);
    expect(cajaDelAtlas({ ...base, departamento: "Amazonas" })).toEqual([0, 41, 40, 80]);
    expect(cajaDelAtlas({ ...base, ciudad: "2209" })).toEqual([10, 10, 20, 20]);
    expect(cajaDelAtlas({ ...base, ciudad: "2209", distritosCiudad: [[12, 12, 14, 14], [15, 15, 18, 18]] })).toEqual([12, 12, 18, 18]);
  });
  it("las ciudades se nombran como ciudad, no como provincia", () => {
    const nombres = new Map((indice as { ciudades: { codigo: string; nombre: string }[] }).ciudades.map((c) => [c.codigo, c.nombre]));
    expect(nombres.get("2209")).toBe("Tarapoto");
    expect(nombres.get("1601")).toBe("Iquitos");
    expect(nombres.get("2501")).toBe("Pucallpa");
  });
});
