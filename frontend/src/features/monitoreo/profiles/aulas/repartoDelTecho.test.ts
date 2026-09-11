import { describe, expect, it } from "vitest";

import { repartoDelTecho, TECHO_DE_AULAS_AGENDABLES } from "./repartoDelTecho";
import type { MonitoreoAulasEfectividadSeguimiento, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * «Dimensionemos los mejores refuerzos, qué facultades ahora lo necesitan,
 * partiendo de un techo de 15 aulas agendables más» (Gonzalo, 2026-09-11), y
 * después: «ojo, hay que pedir también el traslape entre las mejores
 * candidatas».
 */
const bloque = (facs: string[]) => ({
  total: {},
  facultades: facs.map((f) => ({ facultad: f, faculty_key: f.toLowerCase(), aulas_aplicadas: 3 })),
}) as unknown as MonitoreoAulasEfectividadSeguimiento;

const celda = (faculty: string, sex_key: string, target: number, achieved: number) =>
  ({ faculty, sex_key, target, achieved, missing: Math.max(0, target - achieved) });

/**
 * Una reserva del BANCO, dormida y sin resolver: es inventario de refuerzo por
 * sí sola. Una `chain_reserve` no serviría sin sembrar además su titular ya
 * resuelto —sólo se libera cuando su cadena cerró—, y eso es otro test.
 */
const reserva = (codigo: string, faculty: string, sobre: Record<string, unknown> = {}) => ({
  operational_code: codigo, faculty, sample_role: "extra_reserve_pool",
  sample_status: "en_reserva",
  eligible_n: 40, tasa_efectividad_aula: 0.5,
  sex_top_1: "F", sex_top_1_n: 20, sex_top_2: "M", sex_top_2_n: 20,
  teacher: `DOC ${codigo}`, course_id: `CUR ${codigo}`, ...sobre,
}) as unknown as MonitoreoAulasPlanRow;

describe("el reparto de un techo de aulas", () => {
  it("el techo por defecto es el que fijó Gonzalo, no uno del motor", () => {
    expect(TECHO_DE_AULAS_AGENDABLES).toBe(15);
  });

  it("no gasta el techo entero si el déficit se cierra antes", () => {
    const celdas = [celda("A", "F", 10, 9), celda("A", "M", 10, 9)];
    const plan = [reserva("R 1", "A"), reserva("R 2", "A"), reserva("R 3", "A")];
    const out = repartoDelTecho(bloque(["A"]), celdas, plan, 15);
    // Una sola aula de 40 al 50 % cubre los 2 que faltan.
    expect(out.asignadas).toHaveLength(1);
    expect(out.sobran).toBe(14);
    expect(out.quedaSinCubrir).toBe(0);
  });

  it("reparte por lo que cada aula CIERRA, no por quién debe más", () => {
    // Cada aula rinde 10 mujeres y 10 hombres. A debe 12+12 y B debe 8+8, así
    // que A va primera (cierra 20 contra los 16 de B). Pero tras esa, a A sólo
    // le quedan 2+2: su segunda aula cerraría 4 y la primera de B sigue
    // cerrando 16, así que la segunda va a B.
    //
    // Repartir por tamaño de deuda daría las dos a A —debe más— y dejaría a B
    // con sus 16 intactos. Eso es lo que este orden evita.
    const celdas = [
      celda("A", "F", 30, 18), celda("A", "M", 30, 18),
      celda("B", "F", 20, 12), celda("B", "M", 20, 12),
    ];
    const plan = [reserva("R A1", "A"), reserva("R A2", "A"), reserva("R B1", "B")];
    const out = repartoDelTecho(bloque(["A", "B"]), celdas, plan, 2);
    expect(out.asignadas.map((a) => a.facultad)).toEqual(["A", "B"]);
  });

  it("el aporte se acota por sexo: traer de más no cierra de más", () => {
    // Faltan 3 mujeres y 0 hombres; el aula trae 20 y 20, y sólo 3 son útiles.
    const celdas = [celda("A", "F", 10, 7), celda("A", "M", 10, 10)];
    const out = repartoDelTecho(bloque(["A"]), celdas, [reserva("R 1", "A")], 15);
    expect(out.asignadas[0].util).toBe(3);
    expect(out.asignadas[0].aporta.total).toBeGreaterThan(3);
  });

  it("marca el traslape de DOCENTE entre dos elegidas, con cuál solapa", () => {
    // Es cierto y es una sola persona a la que se llama dos veces.
    const celdas = [celda("A", "F", 60, 0), celda("A", "M", 60, 0)];
    const plan = [
      reserva("R 1", "A", { teacher: "PEREZ, ANA" }),
      reserva("R 2", "A", { teacher: "PEREZ, ANA" }),
    ];
    const out = repartoDelTecho(bloque(["A"]), celdas, plan, 2);
    expect(out.traslapes.docente).toBe(1);
    const segunda = out.asignadas[1];
    expect(segunda.traslape).toBe("docente");
    expect(segunda.solapaCon).toBe(out.asignadas[0].codigo);
  });

  it("el traslape de CURSO se marca aparte: es sospecha, no hecho", () => {
    // Sin sección no se distingue dos secciones (alumnos distintos) de un mismo
    // grupo en dos sesiones (los mismos), así que nunca se resta del aporte.
    const celdas = [celda("A", "F", 60, 0), celda("A", "M", 60, 0)];
    const plan = [
      reserva("R 1", "A", { course_id: "1INF37", teacher: "UNO" }),
      reserva("R 2", "A", { course_id: "1INF37", teacher: "DOS" }),
    ];
    const out = repartoDelTecho(bloque(["A"]), celdas, plan, 2);
    expect(out.traslapes.curso).toBe(1);
    expect(out.traslapes.docente).toBe(0);
    // Y el aporte de la segunda NO se recorta por sospechar traslape.
    expect(out.asignadas[1].aporta.total).toBe(out.asignadas[0].aporta.total);
  });

  it("a igual utilidad prefiere la que no repite docente ni curso", () => {
    const celdas = [celda("A", "F", 60, 0), celda("A", "M", 60, 0)];
    const plan = [
      reserva("R 1", "A", { teacher: "REPE", course_id: "C1" }),
      reserva("R 2", "A", { teacher: "REPE", course_id: "C1" }),
      reserva("R 3", "A", { teacher: "OTRO", course_id: "C9" }),
    ];
    const out = repartoDelTecho(bloque(["A"]), celdas, plan, 2);
    expect(out.asignadas[1].traslape).toBeNull();
  });

  it("dice qué facultades se quedan sin recibir y cuántas les harían falta", () => {
    const celdas = [
      celda("A", "F", 60, 0), celda("A", "M", 60, 0),
      celda("B", "F", 30, 0), celda("B", "M", 30, 0),
    ];
    const plan = [reserva("R A1", "A"), reserva("R B1", "B"), reserva("R B2", "B")];
    const out = repartoDelTecho(bloque(["A", "B"]), celdas, plan, 1);
    expect(out.sinRecibir.length).toBeGreaterThan(0);
    expect(out.quedaSinCubrir).toBeGreaterThan(0);
  });

  it("no vuelve a proponer la que la app ya marcó: contaría dos veces", () => {
    const celdas = [celda("A", "F", 60, 0), celda("A", "M", 60, 0)];
    const plan = [reserva("R 1", "A", { sample_status: "refuerzo_por_contactar" })];
    expect(repartoDelTecho(bloque(["A"]), celdas, plan, 5).asignadas).toHaveLength(0);
  });

  it("sin déficit, sin bloque o con techo cero devuelve vacío y no reparte", () => {
    expect(repartoDelTecho(null, [], [], 15).asignadas).toHaveLength(0);
    const celdas = [celda("A", "F", 10, 10), celda("A", "M", 10, 10)];
    expect(repartoDelTecho(bloque(["A"]), celdas, [reserva("R 1", "A")], 15).asignadas).toHaveLength(0);
    expect(repartoDelTecho(bloque(["A"]), celdas, [reserva("R 1", "A")], 0).sobran).toBe(0);
  });
});
