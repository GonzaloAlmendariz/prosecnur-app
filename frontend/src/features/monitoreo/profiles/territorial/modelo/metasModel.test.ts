import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirMetas } from "./metasModel";

const bloque = (extra: Record<string, unknown>) => ({
  id_manzana: "m", ubigeo: "150103", distrito: "ATE", zona: "001", manzana: "0001", tipo_manzana: "titular",
  viviendas: 30, poblacion: 120, entrevistas: 8, metodo: "pps", rango_inicio: 1, rango_fin: 8,
  meta: 8, validas: 0, revision: 0, no_defendibles: 0, avance_pct: null, brecha: null,
  ...extra,
});

const CORTE = {
  route_blocks: [
    bloque({ id_manzana: "a1" }),
    bloque({ id_manzana: "a2", viviendas: 20, poblacion: 80 }),
    bloque({ id_manzana: "a1r", tipo_manzana: "reemplazo", viviendas: 999, poblacion: 9999 }),
    bloque({ id_manzana: "s1", distrito: "SAN MARTIN DE PORRES", viviendas: null, poblacion: null }),
  ],
  advance: { district_progress: [{ distrito: "ATE", meta: 16 }, { distrito: "SAN MARTIN DE PORRES", meta: 8 }] },
  route_overview: { replacement_per_route: 1 },
} as unknown as MonitoreoTerritorialDashboard;

describe("Modelo › Metas y muestra", () => {
  const modelo = construirMetas(CORTE);

  it("meta por distrito con UMP, reemplazos y el tamaño de las manzanas titulares", () => {
    expect(modelo.distritos).toEqual([
      { distrito: "Ate", meta: 16, umps: 2, reemplazos: 1, porUmp: "8", viviendas: 50, poblacion: 200 },
      { distrito: "San Martín de Porres", meta: 8, umps: 1, reemplazos: 0, porUmp: "8", viviendas: null, poblacion: null },
    ]);
    expect(modelo.total).toMatchObject({ meta: 24, umps: 3, reemplazos: 1, porUmp: "8", viviendas: 50, poblacion: 200 });
  });

  it("cómo se arma la muestra sale de las manzanas titulares", () => {
    expect(modelo.comoSeArma.map((item) => `${item.rotulo}: ${item.valor}`)).toEqual([
      "UMP: Manzana titular",
      "Selección: PPS por territorio",
      "Entrevistas por UMP: 8",
      "Rango de viviendas: 1 a 8",
      "Reemplazos por UMP: 1",
      "Reparto de la meta: Por distrito",
    ]);
    // Ningún valor lleva una explicación encadenada: la aclaración va al tooltip.
    for (const item of modelo.comoSeArma) expect(item.valor).not.toMatch(/[;:(·]/);
    expect(modelo.comoSeArma.find((item) => item.clave === "metodo")?.ayuda).toMatch(/proporcional al tamaño/);
  });

  it("sin muestra de Hojas de ruta no hay modelo", () => {
    expect(construirMetas(null).disponible).toBe(false);
  });
});
