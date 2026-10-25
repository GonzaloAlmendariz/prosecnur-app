import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirFichaDeUmp, rotuloDeSexo } from "./fichaUmpModel";
import { CORTE_DE_CUOTAS } from "./fixtures/corteDeCuotas";

const caso = (extra: Record<string, unknown>) => ({
  response_id: "r",
  advance_block_id: "150135063000590",
  advance_block_manzana: "0590",
  advance_valid: true,
  observation_status: "sin_observacion",
  validation_status: "validada",
  submission_date_iso: "2026-06-17",
  submission_hour: "10:15:00",
  sex: "Mujer",
  age: 34,
  distance_m: 40,
  responsible_display: "P132 · Aplicadora de Prueba",
  ...extra,
});

const VALIDACION = {
  report_scope: "validation_summary",
  response_audit: [
    caso({ response_id: "b", submission_hour: "11:40:00", observation_status: "en_observacion", distance_m: 1820 }),
    caso({ response_id: "a" }),
    caso({ response_id: "c", submission_date_iso: "2026-06-18", advance_valid: false, validation_status: "no_defendible", distance_m: null }),
    // De la manzana de reemplazo de la misma UMP.
    caso({ response_id: "d", advance_block_id: "150135063000600", advance_block_manzana: "0600" }),
    // De otra UMP: no entra.
    caso({ response_id: "z", advance_block_id: "150103007000100" }),
  ],
} as unknown as MonitoreoTerritorialDashboard;

describe("ficha de una UMP", () => {
  const ficha = construirFichaDeUmp(CORTE_DE_CUOTAS, VALIDACION, "UMP 143");

  it("la cuota y la subsanación salen del corte de avance", () => {
    expect(ficha).toMatchObject({
      ump: "143", tipo: "Titular", estado: "pendiente", rotuloDeEstado: "Celda de cuota pendiente",
      cuentan: 8, meta: 8, levantadas: 7, subsanado: 1, sugerencia: "UMP 142, a 0.45 km",
    });
    expect(ficha?.faltantes).toEqual([{ texto: "30 a 44 años", falta: 1 }]);
  });

  it("los casos son los de todas sus manzanas, por orden de llegada y rotulados", () => {
    expect(ficha?.casos?.map((item) => item.id)).toEqual(["a", "d", "b", "c"]);
    expect(ficha?.casos?.[2]).toMatchObject({ fecha: "17/06", hora: "11:40", estado: "observacion", rotuloDeEstado: "En observación", distancia: "1.8 km", edad: "34 años", sexo: "Mujer" });
    expect(ficha?.casos?.[3]).toMatchObject({ estado: "no-cuenta", distancia: "Sin GPS" });
    expect([ficha?.enCorte, ficha?.noCuentan]).toEqual([4, 1]);
  });

  it("sin el corte de validación no inventa casos", () => {
    const sinCasos = construirFichaDeUmp(CORTE_DE_CUOTAS, null, "143");
    expect(sinCasos?.casos).toBeNull();
    expect(sinCasos?.enCorte).toBeNull();
  });

  it("una UMP que no existe no tiene ficha", () => {
    expect(construirFichaDeUmp(CORTE_DE_CUOTAS, VALIDACION, "999")).toBeNull();
    expect(construirFichaDeUmp(CORTE_DE_CUOTAS, VALIDACION, null)).toBeNull();
  });

  it("el sexo llega con el código de Kobo y sale con su rótulo, como en el motor de cuotas", () => {
    expect(["1", "2", "Mujer", "", "otro"].map(rotuloDeSexo)).toEqual(["Hombre", "Mujer", "Mujer", "Sin dato", "Otro"]);
  });
});
