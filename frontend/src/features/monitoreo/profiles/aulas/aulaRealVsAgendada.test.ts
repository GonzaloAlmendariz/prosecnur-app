import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { aulaRealVsAgendada, salonDe } from "./aulaRealVsAgendada";

const fila = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

describe("aulaRealVsAgendada", () => {
  it("compara el SALÓN, no el texto entero", () => {
    // El plan guarda «MAR 08:00-10:00 C L321» y el parte sólo «L321»: comparar
    // cadenas daría 100 % de discrepancia.
    const r = aulaRealVsAgendada(
      [fila({ operational_code: "CH 1", actual_room: "L321" })],
      [fila({ operational_code: "CH 1", label: "MAR 08:00-10:00 C L321" })],
    );
    expect(r.comparadas).toBe(1);
    expect(r.cambios).toHaveLength(0);
  });

  it("caza el cambio real de salón", () => {
    const r = aulaRealVsAgendada(
      [fila({ operational_code: "CH 1", faculty: "Derecho", actual_room: "MAR 08:00 H210" })],
      [fila({ operational_code: "CH 1", label: "MAR 08:00 L321" })],
    );
    expect(r.cambios).toEqual([
      { codigo: "CH 1", facultad: "Derecho", agendada: "L321", real: "H210" },
    ]);
  });

  it("toma el ÚLTIMO código del texto, no el primero", () => {
    // «MAR 08:00-10:00 C L321»: quedarse con el primero cogería basura de la
    // hora o del pabellón suelto.
    expect(salonDe("MAR 08:00-10:00 C L321")).toBe("L321");
    expect(salonDe("L321")).toBe("L321");
    expect(salonDe("D102")).toBe("D102");
  });

  it("sin salón reconocible NO cuenta como cambio", () => {
    // No saber no es lo mismo que cambiar.
    const r = aulaRealVsAgendada(
      [fila({ operational_code: "CH 1", actual_room: "por confirmar" })],
      [fila({ operational_code: "CH 1", label: "MAR 08:00 L321" })],
    );
    expect(r.sinComparar).toBe(1);
    expect(r.comparadas).toBe(0);
    expect(r.cambios).toHaveLength(0);
  });
});
