import { describe, expect, it } from "vitest";
import { insigniasDelModo, lecturaDelAvance } from "./barraTerritorial";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";

describe("insignia de Avance territorial", () => {
  it("lleva su base: los casos que cuentan sobre la meta de Avance", () => {
    const reports = { advance: { validas: 1295, meta: 1200 } } as unknown as MonitoreoTerritorialDashboard;
    const insignias = insigniasDelModo(lecturaDelAvance(reports), 253);
    expect(insignias.control).toBe("253");
    expect(insignias.avance).toEqual({
      valor: "108 %",
      base: "1,295/1,200",
      lectura: "1,295 casos que cuentan de una meta de 1,200",
    });
  });

  it("sin meta no publica avance", () => {
    expect(insigniasDelModo(lecturaDelAvance(null), null)).toEqual({});
  });
});
