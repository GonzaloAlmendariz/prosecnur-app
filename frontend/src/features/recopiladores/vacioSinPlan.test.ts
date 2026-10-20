import { describe, expect, it } from "vitest";

import { resolverDireccion } from "./navegacion";
import { origenDelPlan, vacioSinPlan } from "./vacioSinPlan";

describe("origen del plan de Material de campo", () => {
  it("un estudio de aulas lleva a la entrega de Cálculo de muestra", () => {
    expect(origenDelPlan({ modoDelCalculo: "aulas", modulos: ["hojas-ruta"] })).toEqual({
      label: "Ir a Cálculo de muestra",
      to: "/calc-muestra?modo=opinion-universitaria&seccion=salidas",
    });
  });

  it("un proyecto con Hojas de ruta y sin Cálculo lleva a su Selección", () => {
    expect(origenDelPlan({ modoDelCalculo: "territorial", modulos: ["hojas-ruta"] }).to)
      .toBe("/hojas-ruta?seccion=seleccion");
  });

  it("sin pistas lleva a Cálculo de muestra, no inventa un modo", () => {
    expect(origenDelPlan({}).to).toBe("/calc-muestra");
  });
});

describe("vacío sin plan por sección", () => {
  it("Unidades lleva al origen; las demás, a Unidades", () => {
    const origen = { label: "Ir a Hojas de ruta", to: "/hojas-ruta?seccion=seleccion" };
    expect(vacioSinPlan("unidades", origen).accion).toBe(origen);
    for (const seccion of ["accesos", "paquetes", "entrega"] as const) {
      const { accion } = vacioSinPlan(seccion, origen);
      expect(accion.to, seccion).toBe("/material-campo?modo=aulas&seccion=unidades");
      const destino = new URLSearchParams(accion.to.split("?")[1]);
      expect(resolverDireccion(destino.get("seccion"), destino.get("pestana")).seccion).toBe("unidades");
    }
  });

  it("cada vacío dice qué falta en una línea, sin rayas largas ni comillas inglesas", () => {
    for (const seccion of ["unidades", "accesos", "paquetes", "entrega"] as const) {
      const vacio = vacioSinPlan(seccion);
      expect(vacio.titulo.length, seccion).toBeLessThanOrEqual(32);
      expect(vacio.descripcion.length, seccion).toBeLessThanOrEqual(44);
      expect(`${vacio.titulo} ${vacio.descripcion}`).not.toMatch(/[—“”]/);
    }
  });
});
