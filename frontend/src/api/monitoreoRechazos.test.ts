import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialOperationalAdjustment } from "./monitoreo";
import { claveDePaquete, normalizeRechazos } from "./monitoreoRechazos";

const ajuste = (extra: Partial<MonitoreoTerritorialOperationalAdjustment>): MonitoreoTerritorialOperationalAdjustment => ({
  district: "SMP", sex: "Hombre", age_group: "30-44", source_block_id: "m142", target_block_id: "m143", source_response_ids: [], count: 1,
  ...extra,
});

describe("rechazos de subsanación", () => {
  it("la clave del paquete sigue la misma receta que el motor", () => {
    expect(claveDePaquete(ajuste({}))).toBe("m142|m143|hombre|30-44");
    expect(claveDePaquete(ajuste({
      adjustments: [
        ajuste({ sex: "Mujer", age_group: "60+" }),
        ajuste({ source_block_id: "m140", sex: "Hombre", age_group: "18-29" }),
      ],
    }))).toBe("m140|m143|hombre|18-29;m142|m143|mujer|60+");
  });

  it("normaliza lo que serializa Plumber, con un rechazo suelto como objeto", () => {
    const uno = normalizeRechazos({ ok: [true], rechazos: { id: ["rechazo_1"], clave_paquete: ["m142|m143|hombre|30-44"], nota: ["No cuadra"], autor: ["coordinacion"], fecha: ["2026-07-03T20:30:00"], count: [1], target_ump: ["UMP 143"] } });
    expect(uno).toHaveLength(1);
    expect(uno[0]).toMatchObject({ id: "rechazo_1", nota: "No cuadra", autor: "coordinacion", casos: 1, targetUmp: "UMP 143" });
    expect(normalizeRechazos({ rechazos: {} })).toEqual([]);
    expect(normalizeRechazos({ rechazos: [{ id: "sin-clave" }] })).toEqual([]);
  });
});
