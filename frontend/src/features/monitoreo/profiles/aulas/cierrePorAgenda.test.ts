import { describe, expect, it } from "vitest";

import { cierrePorAgenda } from "./cierrePorAgenda";
import type { MonitoreoRow } from "../../../../api/monitoreo";

const fila = (f: Record<string, unknown>) => f as unknown as MonitoreoRow;

/** Aplicada, con lo que esperaba y lo que sacó. */
const aplicada = (fac: string, esperadas: number, efectivas: number) =>
  fila({ faculty: fac, application_state: "cerrando", expected_valid: esperadas, respuestas_validas: efectivas });

/** Agendada para un día, todavía sin aplicar. */
const agendada = (fac: string, fecha: string, esperadas: number) =>
  fila({ faculty: fac, application_state: "lista", expected_valid: esperadas, scheduled_date: fecha });

describe("cierrePorAgenda", () => {
  it("el ritmo lo pone la AGENDA, no el promedio de días", () => {
    // Gonzalo: «no es que si hoy aplicamos treinta, mañana treinta». Un día con
    // tres aulas y otro con una no son el mismo día.
    const r = cierrePorAgenda([
      agendada("DERECHO", "2026-09-11", 10),
      agendada("DERECHO", "2026-09-11", 10),
      agendada("DERECHO", "2026-09-11", 10),
      agendada("DERECHO", "2026-09-12", 10),
    ]);
    expect(r.dias.map((d) => [d.fecha, d.cursos, d.esperadasPlan]))
      .toEqual([["2026-09-11", 3, 30], ["2026-09-12", 1, 10]]);
    expect(r.ultimaFecha).toBe("2026-09-12");
  });

  it("corrige por lo que la facultad está sacando, con evidencia suficiente", () => {
    // Tres aplicadas que rinden la mitad de lo previsto: lo agendado de esa
    // facultad se proyecta a la mitad, no a lo que decía el diseño.
    const r = cierrePorAgenda([
      aplicada("DERECHO", 10, 5), aplicada("DERECHO", 10, 5), aplicada("DERECHO", 10, 5),
      agendada("DERECHO", "2026-09-11", 10),
    ]);
    expect(r.conseguidas).toBe(15);
    expect(r.dias[0].esperadasPlan).toBe(10);
    expect(r.dias[0].esperadasObservado).toBe(5);
    expect(r.dias[0].acumuladoPlan).toBe(25);
    expect(r.dias[0].acumuladoObservado).toBe(20);
  });

  it("con MENOS de tres aplicadas NO corrige: dos visitas no son una tasa", () => {
    // Es la misma cautela que el corte de evidencia del ranking. Proyectar sobre
    // dos anécdotas es lo que este perfil lleva media sesión desmontando.
    const r = cierrePorAgenda([
      aplicada("LETRAS", 10, 1), aplicada("LETRAS", 10, 1),
      agendada("LETRAS", "2026-09-11", 10),
    ]);
    expect(r.dias[0].esperadasObservado).toBe(10);
    expect(r.dias[0].esperadasPlan).toBe(10);
  });

  it("cada facultad se corrige con SU tasa, no con una media del estudio", () => {
    const r = cierrePorAgenda([
      aplicada("A", 10, 10), aplicada("A", 10, 10), aplicada("A", 10, 10),
      aplicada("B", 10, 2), aplicada("B", 10, 2), aplicada("B", 10, 2),
      agendada("A", "2026-09-11", 10),
      agendada("B", "2026-09-11", 10),
    ]);
    // 10 al 100 % + 10 al 20 % = 12, no 20 ni 6.
    expect(r.dias[0].esperadasObservado).toBe(12);
  });

  it("las aulas sin fecha se cuentan aparte: el plan no cierra sin ellas", () => {
    // Ponerles una fecha inventada sería volver a la extrapolación por otra
    // puerta, que es justo lo que él vino a corregir.
    const r = cierrePorAgenda([
      agendada("DERECHO", "2026-09-11", 10),
      // Con su ROL: sin él no se puede saber si es trabajo pendiente o una
      // reserva dormida, y contar de más fue el defecto que infló el plan de
      // 174 a 1 392 dos veces en este perfil.
      fila({ faculty: "DERECHO", sample_role: "titular", application_state: "pendiente", expected_valid: 25 }),
    ]);
    expect(r.sinAgendar).toBe(1);
    expect(r.esperadasSinAgendar).toBe(25);
    expect(r.dias).toHaveLength(1);
  });

  it("lo agendado que ya venció y sigue sin aplicar cuenta desde el corte", () => {
    // Su fecha pasó y sigue pendiente: dejarlo en su día adelantaría el cierre
    // con trabajo que no se hizo.
    const r = cierrePorAgenda([
      agendada("DERECHO", "2026-09-05", 10),
      agendada("DERECHO", "2026-09-12", 10),
    ], "2026-09-09");
    expect(r.dias.map((d) => d.fecha)).toEqual(["2026-09-09", "2026-09-12"]);
  });

  it("las reservas dormidas y el banco NO son trabajo pendiente", () => {
    const r = cierrePorAgenda([
      agendada("DERECHO", "2026-09-11", 10),
      fila({ faculty: "DERECHO", application_state: "en_reserva", expected_valid: 10 }),
      fila({ faculty: "DERECHO", application_state: "reemplazada", expected_valid: 10 }),
    ]);
    expect(r.dias[0].cursos).toBe(1);
    expect(r.sinAgendar).toBe(0);
  });

  it("sin plan y sin nada agendado dice su motivo, no devuelve un cero mudo", () => {
    expect(cierrePorAgenda([]).motivo).toBe("sin-plan");
    expect(cierrePorAgenda([aplicada("A", 10, 10)]).motivo).toBe("sin-agenda");
  });
});

/**
 * **Con la forma que trae la AGENDA de verdad**, que no es la de `course_status`.
 *
 * El módulo se escribió mirando `application_state`, y el motor publica la agenda
 * desde `plan_df`, donde ese campo todavía no existe. Medido en pantalla el
 * 2026-09-10: el filtro descartaba las 143 filas con fecha, `dias` salía vacío,
 * la vista caía al pronóstico de respaldo y el eje se iba a ENERO DE 2027.
 *
 * Ningún test lo vio porque el fixture tenía la forma equivocada. Éste tiene la
 * real: `sample_status` y `operational_status`, sin `application_state`.
 */
describe("cierrePorAgenda con las filas tal como llegan en `agenda`", () => {
  const agendaReal = [
    fila({ faculty: "DERECHO", sample_role: "titular", sample_status: "AGENDADA",
           operational_status: "aplicada", expected_valid: 10, respuestas_validas: 9,
           scheduled_date: "2026-09-08" }),
    fila({ faculty: "DERECHO", sample_role: "titular", sample_status: "AGENDADA",
           operational_status: "agendada", expected_valid: 10, scheduled_date: "2026-09-12" }),
    fila({ faculty: "DERECHO", sample_role: "titular", sample_status: "EN CONTACTO",
           operational_status: "contactada", expected_valid: 10 }),
    fila({ faculty: "DERECHO", sample_role: "chain_reserve", sample_status: "EN RESERVA 1",
           operational_status: "planificada", expected_valid: 10 }),
    fila({ faculty: "DERECHO", sample_role: "titular", sample_status: "RECHAZO",
           operational_status: "cancelada", expected_valid: 10 }),
  ];

  it("reconoce lo aplicado por `operational_status`, no sólo por `application_state`", () => {
    const r = cierrePorAgenda(agendaReal);
    expect(r.conseguidas).toBe(9);
  });

  it("cuenta como agendado lo que tiene fecha y no se aplicó", () => {
    const r = cierrePorAgenda(agendaReal);
    expect(r.dias.map((d) => [d.fecha, d.cursos])).toEqual([["2026-09-12", 1]]);
    expect(r.ultimaFecha).toBe("2026-09-12");
    expect(r.motivo).toBe("");
  });

  it("sin fecha, sólo el TITULAR es trabajo pendiente: la reserva dormida no", () => {
    // Contarla volvería a inflar el plan de 174 a 1 392, que es el defecto que
    // este perfil ya corrigió dos veces.
    expect(cierrePorAgenda(agendaReal).sinAgendar).toBe(1);
  });

  it("un RECHAZO no es trabajo pendiente: entró y se cayó", () => {
    const r = cierrePorAgenda(agendaReal);
    expect(r.sinAgendar).toBe(1);
    expect(r.dias.reduce((n, d) => n + d.cursos, 0)).toBe(1);
  });
});
