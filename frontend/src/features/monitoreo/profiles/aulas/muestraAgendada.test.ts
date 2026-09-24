import { describe, expect, it } from "vitest";

import { esMuestraAgendada, esRefuerzoAgendado } from "./muestraAgendada";
import { estadoInequivocoDeRefuerzo, pasoDelRefuerzo } from "./seguimientoDeRefuerzos";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

// «REFUERZO AGENDADO» (Gonzalo, 2026-09-24): tiene cita como AGENDADA y sigue
// siendo refuerzo. Con siete copias del predicado, la que no se actualizara lo
// contaría como sin agendar.
describe("esMuestraAgendada", () => {
  it("reconoce las formas del libro y del payload", () => {
    for (const v of ["AGENDADA", "agendada", "REAGENDADA", "REFUERZO AGENDADO", "refuerzo_agendado", "Refuerzo agendada"]) {
      expect(esMuestraAgendada(v)).toBe(true);
    }
    for (const v of ["REFUERZO POR CONTACTAR", "EN CONTACTO", "SIN CONTACTAR", "", null]) {
      expect(esMuestraAgendada(v)).toBe(false);
    }
  });

  it("distingue el refuerzo agendado del agendado a secas", () => {
    expect(esRefuerzoAgendado("REFUERZO AGENDADO")).toBe(true);
    expect(esRefuerzoAgendado("AGENDADA")).toBe(false);
  });

  it("en el circuito de refuerzos: sigue siendo refuerzo y ya tiene fecha", () => {
    const fila = { sample_status: "REFUERZO AGENDADO" } as unknown as MonitoreoAulasPlanRow;
    expect(estadoInequivocoDeRefuerzo(fila)).toBe(true);
    expect(pasoDelRefuerzo(fila)).toBe("con_fecha");
  });
});
