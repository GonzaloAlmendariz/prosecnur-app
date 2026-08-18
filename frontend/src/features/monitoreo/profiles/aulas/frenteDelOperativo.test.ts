import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { frenteDelOperativo } from "./frenteDelOperativo";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;
const parte = (codigo: string) => ({ operational_code: codigo });

describe("frenteDelOperativo", () => {
  it("vencida sin parte es lo que hay que perseguir", () => {
    const f = frenteDelOperativo(
      [
        fila({ operational_code: "CH 1", faculty: "Derecho", scheduled_date: "2026-08-10" }),
        fila({ operational_code: "CH 2", faculty: "Derecho", scheduled_date: "2026-08-11" }),
      ],
      [parte("CH 2")],
      "2026-08-18",
    );
    expect(f.vencidas).toBe(2);
    expect(f.vencidasConParte).toBe(1);
    expect(f.pendientes.map((a) => a.codigo)).toEqual(["CH 1"]);
    expect(f.pendientes[0].dias).toBe(8);
  });

  it("el día del corte NO cuenta como vencido", () => {
    // El aula todavía puede aplicarse esa misma tarde: marcarla en rojo por la
    // mañana es una alarma falsa.
    const f = frenteDelOperativo(
      [fila({ operational_code: "HOY", scheduled_date: "2026-08-18" })],
      [],
      "2026-08-18",
    );
    expect(f.vencidas).toBe(0);
    expect(f.porVenir).toBe(1);
  });

  it("el banco no entra: un extra no tiene día que vencer", () => {
    const f = frenteDelOperativo(
      [
        fila({ operational_code: "CH 1", scheduled_date: "2026-08-10" }),
        fila({ operational_code: "EXTRA 1", sample_role: "extra_reserve_pool", scheduled_date: "2026-08-10" }),
      ],
      [],
      "2026-08-18",
    );
    expect(f.conFecha).toBe(1);
    expect(f.pendientes.map((a) => a.codigo)).toEqual(["CH 1"]);
  });

  it("sin fecha se declara aparte, ni al día ni atrasada", () => {
    const f = frenteDelOperativo(
      [fila({ operational_code: "SIN" }), fila({ operational_code: "CON", scheduled_date: "2026-08-10" })],
      [],
      "2026-08-18",
    );
    expect(f.sinFecha).toBe(1);
    expect(f.conFecha).toBe(1);
    expect(f.vencidas).toBe(1);
  });

  it("abre por la que lleva más días caída", () => {
    const f = frenteDelOperativo(
      [
        fila({ operational_code: "RECIENTE", scheduled_date: "2026-08-17" }),
        fila({ operational_code: "ANTIGUA", scheduled_date: "2026-08-10" }),
      ],
      [],
      "2026-08-18",
    );
    expect(f.pendientes.map((a) => a.codigo)).toEqual(["ANTIGUA", "RECIENTE"]);
  });
});
