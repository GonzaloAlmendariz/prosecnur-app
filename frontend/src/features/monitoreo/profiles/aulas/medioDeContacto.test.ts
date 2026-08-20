import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { difereDeVerdad, medioDeContacto } from "./medioDeContacto";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("medioDeContacto", () => {
  it("una fecha de Excel colada NO entra en la mediana, y se cuenta", () => {
    // El caso real: la columna de intentos del libro trae 45909 y 23252, y con
    // ellos la MEDIA del correo sale 19,65 en vez de 3. Creerse ese número
    // llevaría a prohibir el correo.
    const [m] = medioDeContacto([
      fila({ contact_medium: "Correo", contact_attempts: 3, sample_status: "agendada" }),
      fila({ contact_medium: "Correo", contact_attempts: 3, sample_status: "agendada" }),
      fila({ contact_medium: "Correo", contact_attempts: 45909, sample_status: "agendada" }),
    ]);
    expect(m.intentos).toBe(3);
    expect(m.intentosDescartados).toBe(1);
    // La fila SÍ cuenta como aula: lo que se descarta es su número de intentos.
    expect(m.aulas).toBe(3);
  });

  it("ordena por lo que más agenda", () => {
    const salida = medioDeContacto([
      ...Array.from({ length: 8 }, () =>
        fila({ contact_medium: "Llamada", contact_attempts: 2, sample_status: "agendada" })),
      ...Array.from({ length: 2 }, () =>
        fila({ contact_medium: "Llamada", contact_attempts: 2, sample_status: "reemplazada" })),
      ...Array.from({ length: 6 }, () =>
        fila({ contact_medium: "Correo", contact_attempts: 3, sample_status: "agendada" })),
      ...Array.from({ length: 4 }, () =>
        fila({ contact_medium: "Correo", contact_attempts: 3, sample_status: "reemplazada" })),
    ]);
    expect(salida.map((m) => m.medio)).toEqual(["Llamada", "Correo"]);
    expect(salida[0].tasa).toBe(80);
    expect(salida[1].tasa).toBe(60);
  });

  it("«reagendada» también cuenta como conseguida", () => {
    // El medio consiguió la cita; que luego se moviera es otra historia.
    const [m] = medioDeContacto([
      fila({ contact_medium: "Llamada", sample_status: "reagendada" }),
    ]);
    expect(m.agendadas).toBe(1);
  });

  it("el banco no se contacta", () => {
    const salida = medioDeContacto([
      fila({ contact_medium: "Llamada", sample_role: "extra_reserve_pool", sample_status: "en_reserva" }),
    ]);
    expect(salida).toHaveLength(0);
  });

  it("sin intentos declarados la mediana es nula, no cero", () => {
    const [m] = medioDeContacto([fila({ contact_medium: "Llamada", sample_status: "agendada" })]);
    expect(m.intentos).toBeNull();
  });
});

describe("no se ordenan dos medios que el dato no distingue", () => {
  // El panel se titula «Qué medio agenda mejor» y su lectura los ordenaba
  // siempre. Medido sobre el corte: Llamada 82,3 % (121 de 147) y Correo 79,6 %
  // (39 de 49) son **2,7 puntos frente a una banda de 13,1**. Quien lee
  // «Llamada agenda mejor» cambia cómo se contacta a la gente por una diferencia
  // que sale por casualidad la mitad de las veces.
  const medio = (m: string, agendadas: number, aulas: number) =>
    ({ medio: m, aulas, agendadas, tasa: Math.round((1000 * agendadas) / aulas) / 10,
       intentos: 2, intentosDescartados: 0 });

  it("el caso real del corte NO se distingue", () => {
    expect(difereDeVerdad(medio("Llamada", 121, 147), medio("Correo", 39, 49))).toBe(false);
  });

  it("una diferencia grande con tamaños decentes SÍ", () => {
    // 90 % contra 40 % sobre cien casos cada uno: si esto no pasara, el guard
    // seria un filtro que no deja pasar nada.
    expect(difereDeVerdad(medio("Llamada", 90, 100), medio("Correo", 40, 100))).toBe(true);
  });

  it("la misma diferencia con cuatro casos no se distingue", () => {
    // 100 % contra 50 % son 50 puntos, pero de dos aulas contra cuatro.
    expect(difereDeVerdad(medio("A", 2, 2), medio("B", 2, 4))).toBe(false);
  });

  it("un medio sin aulas no se compara", () => {
    expect(difereDeVerdad(medio("A", 0, 0), medio("B", 40, 100))).toBe(false);
  });
});
