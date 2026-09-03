import { describe, expect, it } from "vitest";

import type { MonitoreoAulasFranjas, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { choquesDeHorario } from "./choquesDeHorario";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;
const franjas = (f: Partial<MonitoreoAulasFranjas>) => f as MonitoreoAulasFranjas;

/**
 * El caso del dictado (2026-09-03, CH 30): cita pactada 12:40 sobre una clase
 * MIE 10:00-13:00 con aplicación de 30 min — termina 13:10, después del fin
 * de la clase, y nada lo decía. 2026-09-09 es miércoles.
 */
describe("choquesDeHorario", () => {
  const VENTANA_1240 = franjas({
    duracion_min: 30,
    dias: [{
      fecha: "2026-09-09",
      ventanas: [{ codigo: "CH 30", inicio: "12:40", fin: "13:10", confirmada: true }],
      pico: null,
      por_confirmar: [],
    }],
  });

  it("acusa la aplicación que rebasa el fin de la clase (el caso CH 30)", () => {
    const out = choquesDeHorario(
      [fila({ operational_code: "CH 30", sesiones_dia_hora: "MIE 10:00-13:00" })],
      VENTANA_1240,
    );
    expect(out.get("CH 30")).toBe(
      "la aplicación de 30 min termina 13:10, después del fin de la clase (13:00)",
    );
  });

  it("una cita que SÍ cabe no se acusa", () => {
    const out = choquesDeHorario(
      [fila({ operational_code: "CH 30", sesiones_dia_hora: "MIE 10:00-13:30" })],
      VENTANA_1240,
    );
    expect(out.size).toBe(0);
  });

  it("la pactada fuera de todos los bloques del día se declara", () => {
    const out = choquesDeHorario(
      [fila({ operational_code: "CH 30", sesiones_dia_hora: "MIE 08:00-10:00" })],
      VENTANA_1240,
    );
    expect(out.get("CH 30")).toBe("la hora pactada (12:40) cae fuera del horario de la clase");
  });

  it("un día pactado SIN bloques declarados no se acusa: el plan no sabe de acuerdos extra", () => {
    // La clase es de lunes; la cita cayó miércoles. Puede ser un acuerdo
    // legítimo fuera de horario (aula prestada, sábado extra): acusarlo sería
    // ruido — solo se confronta lo que el plan declara para ESE día.
    const out = choquesDeHorario(
      [fila({ operational_code: "CH 30", sesiones_dia_hora: "LUN 10:00-13:00" })],
      VENTANA_1240,
    );
    expect(out.size).toBe(0);
  });

  it("sin ventana confirmada del motor no hay nada que confrontar", () => {
    const out = choquesDeHorario(
      [fila({ operational_code: "CH 30", sesiones_dia_hora: "MIE 10:00-13:00" })],
      franjas({
        duracion_min: 30,
        dias: [{
          fecha: "2026-09-09",
          ventanas: [{ codigo: "CH 30", inicio: "12:40", fin: "13:10", confirmada: false }],
          pico: null,
          por_confirmar: ["CH 30"],
        }],
      }),
    );
    expect(out.size).toBe(0);
  });

  it("la duración es el eco del motor, no un 30 fijo", () => {
    const out = choquesDeHorario(
      [fila({ operational_code: "CH 30", sesiones_dia_hora: "MIE 10:00-13:00" })],
      franjas({
        duracion_min: 15,
        dias: [{
          fecha: "2026-09-09",
          ventanas: [{ codigo: "CH 30", inicio: "12:40", fin: "12:55", confirmada: true }],
          pico: null,
          por_confirmar: [],
        }],
      }),
    );
    // 12:40 + 15 = 12:55 ≤ 13:00 — cabe.
    expect(out.size).toBe(0);
  });
});
