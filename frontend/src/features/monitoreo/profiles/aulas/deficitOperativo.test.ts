import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { deficitOperativo } from "./deficitOperativo";
import type { CuotaDeFacultad } from "./brechaDeLaFacultad";

/**
 * **Lo que falta, descontando lo que ya viene.**
 *
 * Gonzalo, 2026-09-11: «el déficit debería también tomar en cuenta que hay
 * esperables agendadas, o sea que no es todo lo que debemos, porque ya hay
 * aulas agendadas que esperan recibir más».
 *
 * Medido en HSVG26ULT2 cuando lo dijo: Ciencias Sociales pedía **82 respuestas**
 * y tenía **7 cursos-horario pendientes —6 agendados— que esperaban traer 118**.
 * La pantalla mandaba a reforzar una facultad ya cubierta, y reforzar de más
 * gasta una reserva que otra facultad va a necesitar.
 */

const cuota = (m: number, h: number): CuotaDeFacultad => ({
  mujeres: m, hombres: h,
  meta: { mujeres: m + 30, hombres: h + 30 },
  logrado: { mujeres: 30, hombres: 30 },
});

const fila = (extra: Record<string, unknown>): MonitoreoAulasPlanRow =>
  ({
    faculty: "DERECHO", sample_role: "titular", eligible_n: 20,
    sex_top_1: "F", sex_top_1_n: 10, sex_top_2_n: 10,
    tasa_efectividad_aula: 0.5, operational_status: "planificada",
    sample_status: "en_reserva", ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

describe("el déficit descuenta lo que ya está agendado", () => {
  it("un curso-horario agendado y sin aplicar cuenta como en camino", () => {
    const d = deficitOperativo(cuota(20, 20), [
      fila({ operational_code: "CH 1", sample_status: "agendada" }),
    ], "DERECHO");
    // 20 elegibles al 0,5 → 5 mujeres y 5 hombres en camino.
    expect(d.enCamino).toEqual({ mujeres: 5, hombres: 5, total: 10 });
    expect(d.cursosEnCamino).toBe(1);
    expect(d.quedaria.total).toBe(30);
  });

  it("lo YA aplicado no cuenta dos veces: sus respuestas están en lo logrado", () => {
    const d = deficitOperativo(cuota(20, 20), [
      fila({ operational_code: "CH 1", sample_status: "agendada", respuestas_validas: 9 }),
    ], "DERECHO");
    expect(d.cursosEnCamino).toBe(0);
    expect(d.enCamino.total).toBe(0);
  });

  it("lo que no tiene fecha NO se cuenta como en camino", () => {
    // Un curso-horario sin agendar puede no aplicarse nunca; darlo por seguro
    // dejaría a la facultad sin refuerzo esperando algo que no llega.
    const d = deficitOperativo(cuota(20, 20), [
      fila({ operational_code: "CH 1", sample_status: "sin_contactar" }),
    ], "DERECHO");
    expect(d.cursosEnCamino).toBe(0);
    expect(d.plan.sinAgendar).toBe(1);
  });

  it("el caso de Gonzalo: lo agendado cubre la cuota y NO toca reforzar", () => {
    const d = deficitOperativo(cuota(20, 20), [
      fila({ operational_code: "CH 1", sample_status: "agendada", eligible_n: 60, sex_top_1_n: 30, sex_top_2_n: 30 }),
      fila({ operational_code: "CH 2", sample_status: "agendada", eligible_n: 60, sex_top_1_n: 30, sex_top_2_n: 30 }),
    ], "DERECHO");
    expect(d.enCamino.total).toBe(60);
    expect(d.quedaria.total).toBe(0);
    expect(d.loAgendadoAlcanza).toBe(true);
  });

  it("no alcanza si sobra en un sexo y falta en el otro: la deuda no se compensa", () => {
    // Todo lo agendado son hombres y la facultad debe mujeres. El total cuadra
    // y aun así hay que reforzar; sumar los dos sexos lo escondería.
    const d = deficitOperativo(cuota(20, 0), [
      fila({ operational_code: "CH 1", sample_status: "agendada",
        sex_top_1: "M", sex_top_1_n: 40, sex_top_2_n: 0, eligible_n: 40 }),
    ], "DERECHO");
    expect(d.enCamino.hombres).toBe(20);
    expect(d.quedaria.mujeres).toBe(20);
    expect(d.loAgendadoAlcanza).toBe(false);
  });

  it("el marco del plan cuenta sólo titulares: las reservas son la red, no el plan", () => {
    const d = deficitOperativo(cuota(10, 10), [
      fila({ operational_code: "CH 1", respuestas_validas: 8 }),
      fila({ operational_code: "CH 2", sample_status: "agendada" }),
      fila({ operational_code: "CH 3", sample_status: "sin_contactar" }),
      fila({ operational_code: "R 1.1", sample_role: "chain_reserve" }),
    ], "DERECHO");
    expect(d.plan).toEqual({ delDiseno: 3, aplicados: 1, agendados: 1, sinAgendar: 1 });
  });

  it("sin deuda no declara que lo agendado alcanza: no había nada que alcanzar", () => {
    const d = deficitOperativo(cuota(0, 0), [
      fila({ operational_code: "CH 1", sample_status: "agendada" }),
    ], "DERECHO");
    expect(d.loAgendadoAlcanza).toBe(false);
  });

  it("la frontera de facultad se respeta también aquí", () => {
    const d = deficitOperativo(cuota(20, 20), [
      fila({ operational_code: "CH 9", sample_status: "agendada", faculty: "LETRAS" }),
    ], "DERECHO");
    expect(d.enCamino.total).toBe(0);
    expect(d.plan.delDiseno).toBe(0);
  });
});
