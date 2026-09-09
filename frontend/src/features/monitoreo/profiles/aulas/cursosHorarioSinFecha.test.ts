import { describe, expect, test } from "vitest";

import { cursosHorarioSinFecha } from "./cursosHorarioSinFecha";
import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * Esta cifra existe para RECONCILIAR dos paneles que decían cosas opuestas de la
 * misma pantalla (auditoría del 2026-09-08): «Qué metas van a cerrar y cuáles
 * no» proyecta sobre TODOS los cursos-horario en juego —3 650 contra una cuota
 * de 2 500, con las 30 celdas en ✓— y el acumulado de «Rendimiento diario» sólo
 * sobre lo agendado —2 066—. La diferencia entre ambos universos ES este número.
 *
 * Por eso vive en un helper con test propio: los dos paneles tienen que citarlo
 * igual, y una regla copiada en dos sitios acaba dando dos cifras.
 */

function fila(sobre: Record<string, unknown> = {}): MonitoreoRow {
  return { operational_code: "CH 1", sample_role: "titular", scheduled_date: "", ...sobre } as MonitoreoRow;
}

describe("cursos-horario del plan sin fecha", () => {
  test("cuenta al titular sin fecha y no al que ya la tiene", () => {
    expect(cursosHorarioSinFecha([
      fila({ operational_code: "CH 1" }),
      fila({ operational_code: "CH 2", scheduled_date: "2026-09-10" }),
      fila({ operational_code: "CH 3" }),
    ])).toBe(2);
  });

  test("una RESERVA sin fecha no es una cita que falte por poner", () => {
    // Es una reserva que no ha entrado. Contarla inflaría la cifra con filas que
    // nadie tiene que agendar, y las dos superficies que la citan hablan de la
    // agenda del plan.
    expect(cursosHorarioSinFecha([
      fila({ operational_code: "R 1.1", sample_role: "chain_reserve" }),
      fila({ operational_code: "R 1.2", sample_role: "extra_reserve_pool" }),
      fila({ operational_code: "CH 1" }),
    ])).toBe(1);
  });

  test("el rol vacío cuenta como titular, que es como lo escribe el plan", () => {
    expect(cursosHorarioSinFecha([fila({ sample_role: "" }), fila({ sample_role: "   " })])).toBe(2);
  });

  test("`fecha` vale igual que `scheduled_date`, y los espacios no son una fecha", () => {
    expect(cursosHorarioSinFecha([
      fila({ operational_code: "CH 1", scheduled_date: undefined, fecha: "2026-09-11" }),
      fila({ operational_code: "CH 2", scheduled_date: "   " }),
    ])).toBe(1);
  });

  test("un plan vacío da cero, no revienta", () => {
    expect(cursosHorarioSinFecha([])).toBe(0);
  });
});
