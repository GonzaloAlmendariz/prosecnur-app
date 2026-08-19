import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { consumoDelBanco } from "./consumoDelBanco";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("consumoDelBanco", () => {
  it("mide el ritmo de caídas y cuánto aguanta el colchón", () => {
    const salida = consumoDelBanco([
      // Titular caído el día 10 y otro el 11: una caída por día.
      fila({ operational_code: "CH 1", faculty: "Derecho", titular_operational_code: "CH 1",
        sample_status: "reemplazada", replaced_at: "2026-08-10" } as Partial<MonitoreoAulasPlanRow>),
      fila({ operational_code: "CH 2", faculty: "Derecho", titular_operational_code: "CH 2",
        sample_status: "reemplazada", replaced_at: "2026-08-11" } as Partial<MonitoreoAulasPlanRow>),
      // Dos reservas libres detrás.
      fila({ operational_code: "R 1.1", faculty: "Derecho", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva" }),
      fila({ operational_code: "R 2.1", faculty: "Derecho", sample_role: "chain_reserve",
        titular_operational_code: "CH 2", sample_status: "en_reserva" }),
    ]);
    const d = salida.facultades[0];
    expect(d.caidas).toBe(2);
    expect(d.diasConCaidas).toBe(2);
    expect(d.ritmo).toBe(1);
    expect(d.quedan).toBe(2);
    expect(d.diasHastaAgotarse).toBe(2);
  });

  it("sin reservas quedan CERO días, que no es lo mismo que no saberlo", () => {
    const salida = consumoDelBanco([
      fila({ operational_code: "CH 1", faculty: "X", titular_operational_code: "CH 1",
        sample_status: "reemplazada", replaced_at: "2026-08-10" } as Partial<MonitoreoAulasPlanRow>),
    ]);
    expect(salida.facultades[0].quedan).toBe(0);
    expect(salida.facultades[0].diasHastaAgotarse).toBe(0);
  });

  it("una caída sin fecha se cuenta aparte y no inventa ritmo", () => {
    const salida = consumoDelBanco([
      fila({ operational_code: "CH 1", faculty: "X", titular_operational_code: "CH 1",
        sample_status: "reemplazada" }),
      fila({ operational_code: "R 1.1", faculty: "X", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva" }),
    ]);
    expect(salida.sinFecha).toBe(1);
    expect(salida.facultades[0].ritmo).toBeNull();
    // Sin ritmo no se proyecta: es distinto de «nunca se agota».
    expect(salida.facultades[0].diasHastaAgotarse).toBeNull();
  });

  it("una reserva en el banco no es consumo", () => {
    const salida = consumoDelBanco([
      fila({ operational_code: "CH 1", faculty: "X", titular_operational_code: "CH 1" }),
      fila({ operational_code: "R 1.1", faculty: "X", sample_role: "chain_reserve",
        titular_operational_code: "CH 1", sample_status: "en_reserva" }),
    ]);
    expect(salida.facultades).toHaveLength(0);
    expect(salida.caidasPorDia).toHaveLength(0);
  });
});
