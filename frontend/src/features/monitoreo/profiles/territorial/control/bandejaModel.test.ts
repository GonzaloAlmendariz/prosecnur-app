import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirBandeja, escalaDelEsquema, filtrarBandeja, minutosYSegundos } from "./bandejaModel";

const caso = (extra: Record<string, unknown>) => ({
  id: "c", type: "gps", reason: "", district: "SAN MARTIN DE PORRES", ump: "UMP 145", manzana: "0200",
  responsible: "P222 · Aplicador", submission_date_iso: "2026-06-16", submission_hour: "11:30:00",
  geo_estado: "geo_no_defendible", distance_m: 628, duration_seconds: 895, response_id: "dcb2051a",
  ...extra,
});

const CONSULTAS = {
  internal_queries: {
    review_cases: [
      caso({ id: "d1", type: "duration", geo_estado: "geo_ok", distance_m: 20, duration_seconds: 100, response_id: "r1" }),
      caso({ id: "g1" }),
      caso({ id: "g2", geo_estado: "geo_revision", distance_m: 220, district: "ATE", submission_date_iso: "2026-06-15" }),
      caso({ id: "s1", geo_estado: "geo_sin_gps", distance_m: null }),
      caso({ id: "d2", type: "duration", duration_seconds: 250 }),
    ],
  },
  production_annulments: {
    entries: [
      { id: "a1", status: "active", scope: "response", response_id: "zz1", response_label: "Caso zz1", reason: "GPS fuera", created_at: "2026-06-26" },
      { id: "a2", status: "reverted", scope: "response", response_id: "zz2" },
      { id: "a3", status: "active", scope: "all_production", responsible_key: "p702" },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

describe("Control › Bandeja", () => {
  const modelo = construirBandeja(CONSULTAS);

  it("cada caso con su motivo, ordenados por gravedad y luego por fecha", () => {
    expect(modelo.casos.map((item) => [item.id, item.motivo])).toEqual([
      ["g1", "gps-lejos"], ["g2", "gps-revision"], ["s1", "sin-gps"], ["d1", "muy-corta"], ["d2", "corta"],
    ]);
    expect(modelo.casos[0]).toMatchObject({ dia: "16/06", hora: "11:30", distrito: "San Martín de Porres", ump: "145", distancia: "628 m", duracion: "14:55" });
    expect(modelo.casos[2]).toMatchObject({ distancia: "Sin GPS", distanciaM: null });
  });

  it("un caso de UMP entera se rotula con su UMP, nunca con la clave del motor", () => {
    const conUmp = construirBandeja({
      internal_queries: { review_cases: [caso({ id: "ump:ump_iniciada_incompleta:150108016000580", type: "ump", response_id: "", ump: "UMP 38" })] },
    } as unknown as MonitoreoTerritorialDashboard);
    expect(conUmp?.casos.map((item) => item.etiqueta)).toEqual(["UMP 38"]);
    expect(modelo?.casos.find((item) => item.id === "g1")?.etiqueta).toBe("dcb2051a");
  });

  it("los filtros dicen cuántos casos tiene cada motivo y cada distrito", () => {
    expect(modelo.filtros.map((filtro) => [filtro.clave, filtro.casos])).toEqual([
      ["gps-lejos", 1], ["gps-revision", 1], ["sin-gps", 1], ["muy-corta", 1], ["corta", 1],
    ]);
    expect(modelo.distritos).toEqual([{ distrito: "Ate", casos: 1 }, { distrito: "San Martín de Porres", casos: 4 }]);
    expect(filtrarBandeja(modelo.casos, "gps-revision", null).map((item) => item.id)).toEqual(["g2"]);
    expect(filtrarBandeja(modelo.casos, null, "Ate").map((item) => item.id)).toEqual(["g2"]);
  });

  it("los anulados son los casos anulados uno a uno que siguen activos", () => {
    expect(modelo.anulados).toEqual([{ id: "a1", responseId: "zz1", rotulo: "Caso zz1", motivo: "GPS fuera", dia: "26/06" }]);
  });

  it("una encuesta larga no es un problema: no entra a la bandeja ni a sus conteos", () => {
    const conLarga = construirBandeja({
      internal_queries: { review_cases: [caso({ id: "l1", type: "duration", geo_estado: "geo_ok", distance_m: 10, duration_seconds: 9000, duration_status: "extrema", duration_operational_status: "normal" })] },
    } as unknown as MonitoreoTerritorialDashboard);
    expect(conLarga.casos).toEqual([]);
    expect(conLarga.filtros).toEqual([]);
  });

  it("sin el corte de Consultas la bandeja no está disponible; con cero casos, sí", () => {
    expect(construirBandeja(null).disponible).toBe(false);
    expect(construirBandeja({ internal_queries: { review_cases: [] } } as unknown as MonitoreoTerritorialDashboard).disponible).toBe(true);
  });

  it("duración en min:s y escala del esquema que siempre muestra los dos anillos", () => {
    expect(minutosYSegundos(895)).toBe("14:55");
    expect(minutosYSegundos(null)).toBe("—");
    expect(escalaDelEsquema(628)).toEqual({ radioMaximo: 800, anillos: [150, 300] });
    expect(escalaDelEsquema(null).radioMaximo).toBe(400);
  });
});
