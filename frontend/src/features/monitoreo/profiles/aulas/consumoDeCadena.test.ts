import { describe, expect, test } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { consumoDeCadena } from "./consumoDeCadena";

function titular(codigo: string): MonitoreoAulasPlanRow {
  return { operational_code: codigo, sample_role: "titular" } as unknown as MonitoreoAulasPlanRow;
}

function reserva(codigo: string, de: string, estado: string): MonitoreoAulasPlanRow {
  return {
    operational_code: codigo,
    sample_role: "chain_reserve",
    replacement_for: de,
    sample_status: estado,
  } as unknown as MonitoreoAulasPlanRow;
}

describe("consumoDeCadena", () => {
  test("reparte las cadenas por reservas ya gastadas", () => {
    const res = consumoDeCadena([
      titular("CH 1"), reserva("R 1.1", "CH 1", "en_reserva"),
      titular("CH 2"), reserva("R 2.1", "CH 2", "agendada"), reserva("R 2.2", "CH 2", "en_reserva"),
      titular("CH 3"), reserva("R 3.1", "CH 3", "aplicada"), reserva("R 3.2", "CH 3", "agendada"),
    ]);
    expect(res.tramos.map((t) => t.cadenas)).toEqual([1, 1, 1, 0]);
    expect(res.reservasLibres).toBe(2);
    expect(res.reservasGastadas).toBe(3);
  });

  test("una cadena sin ninguna reserva no es una cadena «sin gastar»", () => {
    // L54: nunca haber tenido reserva es una decision del diseño muestral;
    // tenerla y no haberla usado es un hecho del operativo. Meterlas en el mismo
    // tramo diria que el plan tiene un colchon que no tiene.
    const res = consumoDeCadena([
      titular("CH 1"),
      titular("CH 2"), reserva("R 2.1", "CH 2", "en_reserva"),
    ]);
    expect(res.sinReserva).toBe(1);
    expect(res.tramos[0].cadenas).toBe(1);
    expect(res.cadenas).toBe(1);
    expect(res.total).toBe(2);
  });

  test("la cadena vacia cuenta como libre, igual que en el motor", () => {
    // Un plan recien importado no trae `sample_status`. Si contara como gastada,
    // el grafico diria que el operativo empezo consumido.
    const res = consumoDeCadena([
      titular("CH 1"), reserva("R 1.1", "CH 1", ""), reserva("R 1.2", "CH 1", "sin_contactar"),
    ]);
    expect(res.reservasGastadas).toBe(0);
    expect(res.reservasLibres).toBe(2);
    expect(res.tramos[0].cadenas).toBe(1);
  });

  test("agrupa en «3 o más» sin perder cadenas largas", () => {
    const largas = ["a", "b", "c", "d", "e", "f"].map((k) => reserva(`R 1.${k}`, "CH 1", "aplicada"));
    const res = consumoDeCadena([titular("CH 1"), ...largas]);
    expect(res.tramos[3].cadenas).toBe(1);
    expect(res.reservasGastadas).toBe(6);
  });

  test("una reserva cuyo titular no viene en las filas sigue contando", () => {
    // La agenda recorta a 400 filas y las reservas van al final del plan: si la
    // cadena solo existiera cuando su titular esta visible, el grafico
    // desapareceria justo en el estudio grande, que es donde importa.
    const res = consumoDeCadena([reserva("R 9.1", "CH 9", "agendada")]);
    expect(res.total).toBe(1);
    expect(res.tramos[1].cadenas).toBe(1);
  });
});
