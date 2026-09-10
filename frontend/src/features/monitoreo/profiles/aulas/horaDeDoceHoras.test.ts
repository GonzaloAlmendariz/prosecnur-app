import { describe, expect, it } from "vitest";

import { horasDeDoceHoras } from "./horaDeDoceHoras";
import type { MonitoreoRow } from "../../../../api/monitoreo";

const fila = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

/** Casos REALES del operativo, medidos el 2026-09-10 sobre el .pulso armado. */
const plan = [
  fila({ operational_code: "R 131.1", sesiones_dia_hora: "LUN 14:00-17:00 · MAR 14:00-17:00" }),
  fila({ operational_code: "CH 173", sesiones_dia_hora: "MAR 17:00-19:00 · JUE 17:00-19:00" }),
  fila({ operational_code: "CH 82", sesiones_dia_hora: "MAR 12:00-13:30 · VIE 12:00-13:30" }),
  fila({ operational_code: "CH 51", sesiones_dia_hora: "LUN 07:00-09:00 · MAR 07:00-09:00" }),
  fila({ operational_code: "SIN HORARIO" }),
];

describe("horasDeDoceHoras", () => {
  it("cuenta sólo las anteriores al arranque del operativo", () => {
    const out = horasDeDoceHoras([
      fila({ operational_code: "R 131.1", applied_time: "2:45" }),
      fila({ operational_code: "CH 51", applied_time: "8:53" }),
      fila({ operational_code: "CH 82", applied_time: "12:30" }),
    ], plan);
    expect(out.map((h) => h.codigo)).toEqual(["R 131.1"]);
  });

  it("cuadra de tarde cuando la hora + 12 cae dentro de la ventana del plan", () => {
    // R 131.1 a las 2:45 con el curso de 14:00 a 17:00 → 14:45, dentro.
    // CH 173 a las 6:30 con el de 17:00 a 19:00 → 18:30, dentro.
    const out = horasDeDoceHoras([
      fila({ operational_code: "R 131.1", applied_time: "2:45" }),
      fila({ operational_code: "CH 173", applied_time: "6:30" }),
    ], plan);
    expect(out.every((h) => h.cuadraDeTarde)).toBe(true);
  });

  it("NO cuadra cuando la ventana del plan es de mañana: la regla no es universal", () => {
    // CH 82 a las 5:04 con el curso de 12:00 a 13:30 → 17:04, fuera. Es uno de
    // los dos casos reales que impiden corregir el dato a ciegas.
    const out = horasDeDoceHoras([fila({ operational_code: "CH 82", applied_time: "5:04" })], plan);
    expect(out).toHaveLength(1);
    expect(out[0].cuadraDeTarde).toBe(false);
    expect(out[0].ventana).toContain("12:00-13:30");
  });

  it("sin horario en el plan no inventa una ventana", () => {
    const out = horasDeDoceHoras([fila({ operational_code: "SIN HORARIO", applied_time: "3:00" })], plan);
    expect(out[0].ventana).toBeNull();
    expect(out[0].cuadraDeTarde).toBe(false);
  });

  it("no corrige el dato: devuelve lo que el parte trae escrito", () => {
    const out = horasDeDoceHoras([fila({ operational_code: "R 131.1", applied_time: "2:45" })], plan);
    expect(out[0].escrita).toBe("2:45");
  });

  it("una hora ilegible no entra: no se sabe si es de mañana o de tarde", () => {
    expect(horasDeDoceHoras([fila({ operational_code: "R 131.1", applied_time: "temprano" })], plan))
      .toEqual([]);
  });
});
