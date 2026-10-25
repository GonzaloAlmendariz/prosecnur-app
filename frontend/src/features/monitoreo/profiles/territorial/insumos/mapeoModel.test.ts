import { describe, expect, it } from "vitest";
import type { MonitoreoState, MonitoreoTerritorialDashboard, MonitoreoTerritorialMapeo } from "../../../../../api/client";
import { construirMapeo } from "./mapeoModel";

const MAPEO = {
  ok: true,
  fase: "field",
  columnas: [],
  variables: [
    { campo: "district_var", etiqueta: "Distrito", apunta_a: "Core/M5_district", resuelta: true, motivo: "" },
    { campo: "sex_var", etiqueta: "Sexo", apunta_a: "", resuelta: false, motivo: "sin_mapear" },
    { campo: "age_var", etiqueta: "Edad", apunta_a: "Core/E1_age", resuelta: false, motivo: "columna_ausente" },
  ],
  aviso: { ok: false, n_pendientes: 2, mensaje: "" },
} as MonitoreoTerritorialMapeo;

const STATE = {
  config: {
    territorial: {
      geo_thresholds_m: { cerca: 150, revision: 300 },
      min_duration_seconds: 60,
      max_duration_seconds: 7200,
      high_age_review: 95,
      district_crosswalk: [
        { kobo_code: "1", kobo_label: "Ate", ubigeo: "150103", distrito: "ATE" },
        { kobo_code: "9", kobo_label: "Otro", ubigeo: "", distrito: "" },
      ],
    },
  },
} as unknown as MonitoreoState;

const REPORTS = {
  source_validity: { field: "consent", field_label: "¿Acepta continuar?", values: ["1"], options: [{ value: "1", label: "Sí" }, { value: "0", label: "No" }], effective_count: 1404, non_effective_count: 289, total_responses: 1693 },
} as unknown as MonitoreoTerritorialDashboard;

describe("Insumos › Mapeo y filtro", () => {
  const modelo = construirMapeo(MAPEO, STATE, REPORTS);

  it("cada rol con su columna y si está en la base, con el motivo de la falta", () => {
    expect(modelo.roles?.map((rol) => [rol.rol, rol.columna, rol.estado, rol.rotuloDeEstado])).toEqual([
      ["Distrito", "Core/M5_district", "encontrada", "En la base"],
      ["Sexo", "", "sin-mapear", "Sin columna"],
      ["Edad", "Core/E1_age", "ausente", "Columna ausente"],
    ]);
    expect(modelo.pendientes).toBe(2);
  });

  it("el filtro de efectivas dice cuántas pasan sobre su base", () => {
    expect(modelo.filtro).toEqual({ pregunta: "¿Acepta continuar?", valores: ["Sí"], pasan: 1404, noPasan: 289, base: 1693, proporcion: "83 %" });
  });

  it("los umbrales en sus unidades y los distritos con su ubigeo", () => {
    expect(modelo.umbrales.map((u) => u.valor)).toEqual(["150 m", "300 m", "60 s", "120 min", "95 años"]);
    expect(modelo.distritos).toEqual([
      { codigo: "1", etiqueta: "Ate", ubigeo: "150103", distrito: "Ate", ok: true },
      { codigo: "9", etiqueta: "Otro", ubigeo: "", distrito: "Sin distrito", ok: false },
    ]);
  });

  it("sin el mapeo del motor los roles quedan sin dato, no vacíos", () => {
    expect(construirMapeo(null, STATE, REPORTS).roles).toBeNull();
  });
});
