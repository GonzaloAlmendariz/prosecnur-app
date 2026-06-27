import { describe, expect, it } from "vitest";
import type { TerritorialBlockProgress } from "../../api/client";
import {
  buildTerritorialRouteCoverageModel,
  filterTerritorialRouteBlocks,
  normalizeRouteUmpKey,
  routeBlockStableKey,
  routeOperationalLabel,
} from "./routeCoverageModel";

function makeBlock(overrides: Partial<TerritorialBlockProgress>): TerritorialBlockProgress {
  return {
    id_manzana: "150132-10700-0590",
    ubigeo: "150132",
    distrito: "SAN JUAN DE LURIGANCHO",
    zona: "10700",
    manzana: "0590",
    tipo_manzana: "titular",
    viviendas: 78,
    poblacion: 301,
    territorio_muestral: "150132-10700",
    responsable: "P739 · Cuba Del Rio Juan Acisclo",
    orden_seleccion: 89,
    hoja_num: 89,
    rango_inicio: 705,
    rango_fin: 712,
    entrevistas: 8,
    medida_tamano: null,
    lat: null,
    lon: null,
    ump: "89",
    meta: 8,
    validas: 3,
    revision: 1,
    no_defendibles: 0,
    avance_pct: 50,
    brecha: 4,
    ...overrides,
  };
}

describe("routeCoverageModel", () => {
  it("filters route blocks with UMP-first expanded search", () => {
    const blocks = [
      makeBlock({}),
      makeBlock({
        id_manzana: "150140-02000-0722",
        ubigeo: "150140",
        distrito: "SANTIAGO DE SURCO",
        zona: "02000",
        manzana: "0722",
        responsable: "A001 · Equipo Sur",
        hoja_num: 90,
        orden_seleccion: 90,
        ump: "90",
        rango_inicio: 713,
        rango_fin: 720,
      }),
    ];

    expect(filterTerritorialRouteBlocks(blocks, { query: "UMP 089" }).map(routeBlockStableKey)).toEqual([routeBlockStableKey(blocks[0])]);
    expect(filterTerritorialRouteBlocks(blocks, { query: "ump89" }).map(routeBlockStableKey)).toEqual([routeBlockStableKey(blocks[0])]);
    expect(filterTerritorialRouteBlocks(blocks, { query: "UMP-090" }).map(routeBlockStableKey)).toEqual([routeBlockStableKey(blocks[1])]);
    expect(filterTerritorialRouteBlocks(blocks, { query: "89" }).map(routeBlockStableKey)).toEqual([routeBlockStableKey(blocks[0])]);
    expect(filterTerritorialRouteBlocks(blocks, { query: "0590" }).map(routeBlockStableKey)).toEqual([routeBlockStableKey(blocks[0])]);
    expect(filterTerritorialRouteBlocks(blocks, { query: "705-712" }).map(routeBlockStableKey)).toEqual([routeBlockStableKey(blocks[0])]);
    expect(filterTerritorialRouteBlocks(blocks, { query: "juan acisclo" }).map(routeBlockStableKey)).toEqual([routeBlockStableKey(blocks[0])]);
    expect(filterTerritorialRouteBlocks(blocks, { districtFilter: "150140", query: "sur" }).map(routeBlockStableKey)).toEqual([routeBlockStableKey(blocks[1])]);
  });

  it("normalizes equivalent UMP labels to the same key", () => {
    expect(normalizeRouteUmpKey("50")).toBe("50");
    expect(normalizeRouteUmpKey("UMP 50")).toBe("50");
    expect(normalizeRouteUmpKey("ump50")).toBe("50");
    expect(normalizeRouteUmpKey("UMP-050")).toBe("50");
  });

  it("labels replacement manzanas as the replacement of the base UMP", () => {
    expect(routeOperationalLabel(makeBlock({
      tipo_manzana: "reemplazo",
      replacement_order: 1,
      titular_hoja_num: 50,
      ump: "50",
    }))).toBe("UMP 50 · R1");
  });

  it("builds coverage totals by district, zones, sex and age", () => {
    const blocks = [
      makeBlock({}),
      makeBlock({
        id_manzana: "150132-10700-0610",
        manzana: "0610",
        tipo_manzana: "reemplazo",
        replacement_order: 1,
        titular_hoja_num: 89,
        poblacion: 120,
        validas: 1,
      }),
      makeBlock({
        id_manzana: "150140-02000-0722",
        ubigeo: "150140",
        distrito: "SANTIAGO DE SURCO",
        zona: "02000",
        manzana: "0722",
        hoja_num: 90,
        orden_seleccion: 90,
        ump: "90",
        poblacion: 200,
        validas: 2,
      }),
    ];

    const model = buildTerritorialRouteCoverageModel(blocks, {
      route_quota_marginals: {
        blocks: [
          {
            id_manzana: "150132-10700-0590",
            ubigeo: "150132",
            distrito: "SAN JUAN DE LURIGANCHO",
            zona: "10700",
            manzana: "0590",
            total: 8,
            sex_totals: [{ label: "Hombre", value: 4 }, { label: "Mujer", value: 4 }],
            age_totals: [{ label: "18-29", value: 5 }, { label: "30-44", value: 3 }],
          },
          {
            id_manzana: "150140-02000-0722",
            ubigeo: "150140",
            distrito: "SANTIAGO DE SURCO",
            zona: "02000",
            manzana: "0722",
            total: 4,
            sex_totals: [{ label: "Hombre", value: 1 }, { label: "Mujer", value: 3 }],
            age_totals: [{ label: "18-29", value: 2 }, { label: "30-44", value: 2 }],
          },
        ],
      },
      route_quota_progress: {
        schema: "monitoreo_territorial_quota_progress_v1",
        configured: true,
        blocks: [],
        districts: [
          {
            ubigeo: "150132",
            distrito: "SAN JUAN DE LURIGANCHO",
            configured: true,
            status: "in_field",
            target: 8,
            validas: 4,
            missing_total: 4,
            sex: [{ label: "Hombre", target: 4, achieved: 2, missing: 2 }, { label: "Mujer", target: 4, achieved: 2, missing: 2 }],
            age: [{ label: "18-29", target: 5, achieved: 3, missing: 2 }, { label: "30-44", target: 3, achieved: 1, missing: 2 }],
            missing: [],
          },
        ],
      },
    });

    expect(model.totals.districts).toBe(2);
    expect(model.totals.zones).toBe(2);
    expect(model.totals.titulares).toBe(2);
    expect(model.totals.reemplazos).toBe(1);
    expect(model.totals.target).toBe(12);
    expect(model.totals.validas).toBe(6);
    expect(model.districts[0].distrito).toBe("SAN JUAN DE LURIGANCHO");
    expect(model.districts[0].zones).toBe(1);
    expect(model.sexTotals.find((row) => row.label === "Hombre")?.target).toBe(5);
    expect(model.sexTotals.find((row) => row.label === "Hombre")?.achieved).toBe(2);
    expect(model.ageTotals.find((row) => row.label === "18-29")?.target).toBe(7);
  });
});
