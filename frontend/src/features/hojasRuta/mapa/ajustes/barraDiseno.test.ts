import { describe, expect, it } from "vitest";
import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { alcanceEstudio, seccionLista } from "./barraDiseno";
import { cambiosSinAplicar, resumenDiseno } from "./BotonDiseno";

describe("barra de Hojas de ruta (maqueta, lámina 0)", () => {
  it("el alcance dice las ciudades del estudio", () => {
    expect(alcanceEstudio(["Lima y Callao", "Arequipa"], 8)).toBe("Lima y Callao, Arequipa");
    expect(alcanceEstudio(["Lima y Callao", "Arequipa", "Trujillo", "Piura"], 20)).toBe("Lima y Callao y 3 ciudades más");
    expect(alcanceEstudio([], 0)).toBe("Por elegir");
  });
  it("cada sección está lista cuando existe lo que entrega", () => {
    const e = { distritos: 8, matriz: true, tamano: true, sorteo: false, enviado: false };
    expect(["territorio", "poblacion", "muestra", "manzanas", "seleccion"].map((id) => seccionLista(id, e))).toEqual([true, true, true, false, false]);
  });
  it("el botón Diseño resume N, k y estrato y cuenta los grupos sin aplicar", () => {
    const c = { n_objetivo: 1800, entrevistas_por_manzana: 8, sample_size: { estrato: "provincia" } } as unknown as HojasRutaIntegratedConfig;
    expect(resumenDiseno(c, 1200)).toBe("1,200, 8 por ruta, por provincia");
    expect(cambiosSinAplicar({ rangos: null, cortes: {}, muestra: {}, sorteo: null })).toBe(2);
    expect(cambiosSinAplicar({ rangos: null, cortes: null, muestra: null, sorteo: null })).toBe(0);
  });
});
