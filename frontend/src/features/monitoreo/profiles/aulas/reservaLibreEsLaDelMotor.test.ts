import { describe, expect, it } from "vitest";
import { colchonPorFacultad } from "./consumoDeCadena";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * «Reserva libre» tiene que significar lo mismo aquí que en
 * `monitoreo_aulas_reservas_disponibles()`, que resuelve con
 * `MONITOREO_AULAS_ESTADOS_DORMIDOS`. Si divergen, la pantalla da por gastada una
 * reserva que el motor sigue ofreciendo.
 *
 * **Y divergían**: había una lista propia de tres —`en_reserva`,
 * `sin_contactar`, `""`— frente a los cinco del motor, así que faltaban `"-"` y
 * `"planificada"`. No se ve en este estudio, que no tiene ninguno de los dos en
 * `sample_status`, pero `"-"` es como el equipo escribe «todavía nada aquí»: en
 * 2025 fueron **1.810 de 2.040 celdas**.
 */
const reserva = (titular: string, sample_status: string) => ({
  operational_code: `R ${titular}.${sample_status.length}`,
  titular_operational_code: titular,
  sample_role: "chain_reserve",
  sample_status,
  faculty: "EDUCACION",
}) as unknown as MonitoreoAulasPlanRow;

const titular = (codigo: string) => ({
  operational_code: codigo, titular_operational_code: codigo,
  sample_role: "titular", sample_status: "agendada", faculty: "EDUCACION",
}) as unknown as MonitoreoAulasPlanRow;

const libresDe = (filas: MonitoreoAulasPlanRow[]) =>
  colchonPorFacultad(filas).reduce((n, f) => n + Number(f.libres ?? 0), 0);

describe("«reserva libre» es la definición del motor, no una propia", () => {
  it("cuenta libres los dos estados que faltaban: «-» y «planificada»", () => {
    // Con la lista vieja, estas dos salían como gastadas.
    expect(libresDe([titular("CH 1"), reserva("CH 1", "-")])).toBe(1);
    expect(libresDe([titular("CH 2"), reserva("CH 2", "planificada")])).toBe(1);
  });

  it("sigue contando los tres que ya contaba", () => {
    for (const estado of ["en_reserva", "sin_contactar", ""]) {
      expect(libresDe([titular("CH 3"), reserva("CH 3", estado)]), estado).toBe(1);
    }
  });

  it("una reserva ya usada no cuenta como libre", () => {
    expect(libresDe([titular("CH 4"), reserva("CH 4", "agendada")])).toBe(0);
    expect(libresDe([titular("CH 5"), reserva("CH 5", "reemplazada")])).toBe(0);
  });
});
