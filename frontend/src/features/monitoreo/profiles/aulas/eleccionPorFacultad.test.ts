import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { eleccionPorFacultad, pedidasPorLaApp } from "./eleccionPorFacultad";

/**
 * **El orden tiene que cambiar tras cada elección.** Gonzalo, 2026-09-11: «si
 * escogemos uno el traslape podría aumentar para el resto y ya no serían las
 * mejores alternativas». Lo que se comprueba aquí es exactamente eso: que una
 * candidata que rinde MÁS baje por debajo de una que rinde menos en cuanto
 * repite docente con algo ya elegido — y que la cifra que se enseña no se toque.
 */

const FACULTAD = "DERECHO";

const titular = (extra: Record<string, unknown> = {}) => ({
  operational_code: "CH 1", faculty: FACULTAD, sample_role: "titular",
  sample_status: "agendada", operational_status: "agendada",
  eligible_students: 100, eligible_female: 50, eligible_male: 50,
  respuestas_validas: 0, ...extra,
} as unknown as MonitoreoAulasPlanRow);

/**
 * Una reserva extra de la facultad: la que `inventarioDeLaFacultad()` admite sin
 * romper cadena. La composición por sexo viaja como `sex_top_*`, que es la forma
 * en que el motor la publica.
 */
const reserva = (codigo: string, mujeres: number, hombres: number,
                 extra: Record<string, unknown> = {}) => ({
  operational_code: codigo, faculty: FACULTAD, sample_role: "extra_reserve_pool",
  sample_status: "sin_contactar", operational_status: "planificada",
  sex_top_1: "F", sex_top_1_n: mujeres, sex_top_2: "M", sex_top_2_n: hombres,
  tasa_efectividad_aula: 1,
  teacher: "DOCENTE A", course_id: "DER101",
  respuestas_validas: 0, ...extra,
} as unknown as MonitoreoAulasPlanRow);

const bloque = { facultades: [{ facultad: FACULTAD }] } as never;
// La forma que publica el motor en `quotas_sex_faculty`: `sex_key` normalizado
// a F/M, `target` la meta y `missing` lo que falta.
const cuotas = [{ faculty: FACULTAD, sex_key: "F", target: 60, missing: 60, achieved: 0 },
                { faculty: FACULTAD, sex_key: "M", target: 60, missing: 60, achieved: 0 }];

describe("pedidasPorLaApp", () => {
  it("cuenta lo que la app selló, y sólo eso", () => {
    expect(pedidasPorLaApp([
      reserva("R 1.1", 10, 10, { activation_origin: "refuerzo" }),
      reserva("R 1.2", 10, 10, { activation_origin: "complemento" }),
      // Éste lo activó el camino de A (reemplazo), que no gasta el techo de la app.
      reserva("R 1.3", 10, 10, { activation_origin: "reemplazo" }),
      reserva("R 1.4", 10, 10),
    ])).toBe(2);
  });

  it("cuenta también las que ya aplicaron: el sitio del techo ya se gastó", () => {
    expect(pedidasPorLaApp([
      reserva("R 1.1", 10, 10, { activation_origin: "refuerzo", sample_status: "agendada", respuestas_validas: 20 }),
    ])).toBe(1);
  });
});

describe("eleccionPorFacultad", () => {
  const plan = [
    titular(),
    reserva("R 1.1", 20, 20, { teacher: "DOCENTE A", course_id: "DER101" }),
    reserva("R 1.2", 10, 10, { teacher: "DOCENTE B", course_id: "DER202" }),
    reserva("R 1.3", 30, 30, { teacher: "DOCENTE A", course_id: "DER303" }),
  ];

  it("sin nada elegido, manda lo que más cierra", () => {
    const e = eleccionPorFacultad(bloque, cuotas, plan, FACULTAD, 15);
    expect(e.facultad).toBe(FACULTAD);
    expect(e.cola[0]?.codigo).toBe("R 1.3");
    expect(e.cola.every((c) => c.relegadaPor === null)).toBe(true);
  });

  it("elegida una, la que repite su docente baja por debajo de las limpias aunque rinda más", () => {
    // R 1.3 rinde más que R 1.2, pero comparte docente con la ya elegida.
    const conUna = plan.map((f) => (String(f.operational_code) === "R 1.1"
      ? ({ ...f, activation_origin: "refuerzo", sample_status: "refuerzo_por_contactar" } as MonitoreoAulasPlanRow)
      : f));
    const e = eleccionPorFacultad(bloque, cuotas, conUna, FACULTAD, 15);
    expect(e.cola.map((c) => c.codigo)).toEqual(["R 1.2", "R 1.3"]);
    const relegada = e.cola.find((c) => c.codigo === "R 1.3");
    expect(relegada?.relegadaPor).toBe("docente");
    expect(relegada?.solapaCon).toBe("R 1.1");
    // Y la cifra NO se toca: relegar es un salto de puesto, no un descuento.
    expect(relegada?.aporta.total).toBeGreaterThan(
      e.cola.find((c) => c.codigo === "R 1.2")!.aporta.total);
  });

  it("la ya pedida sale de la cola: no se puede gastar dos veces contra el techo", () => {
    const conUna = plan.map((f) => (String(f.operational_code) === "R 1.1"
      ? ({ ...f, activation_origin: "refuerzo", sample_status: "refuerzo_por_contactar" } as MonitoreoAulasPlanRow)
      : f));
    const e = eleccionPorFacultad(bloque, cuotas, conUna, FACULTAD, 15);
    expect(e.cola.map((c) => c.codigo)).not.toContain("R 1.1");
  });

  it("el techo cuenta lo pedido y nunca baja de cero", () => {
    const conDos = plan.map((f) => (["R 1.1", "R 1.2"].includes(String(f.operational_code))
      ? ({ ...f, activation_origin: "refuerzo" } as MonitoreoAulasPlanRow)
      : f));
    expect(eleccionPorFacultad(bloque, cuotas, conDos, FACULTAD, 15).quedanDelTecho).toBe(13);
    expect(eleccionPorFacultad(bloque, cuotas, conDos, FACULTAD, 1).quedanDelTecho).toBe(0);
  });

  it("el repite-curso releva también, y se dice como sospecha y no como hecho", () => {
    const mismoCurso = [
      titular(),
      reserva("R 2.1", 20, 20, { teacher: "DOCENTE A", course_id: "DER101", activation_origin: "refuerzo" }),
      reserva("R 2.2", 20, 20, { teacher: "DOCENTE C", course_id: "DER101" }),
      reserva("R 2.3", 5, 5, { teacher: "DOCENTE D", course_id: "DER999" }),
    ];
    const e = eleccionPorFacultad(bloque, cuotas, mismoCurso, FACULTAD, 15);
    expect(e.cola[0]?.codigo).toBe("R 2.3");
    expect(e.cola.find((c) => c.codigo === "R 2.2")?.relegadaPor).toBe("curso");
  });

  it("sin facultad pedida abre por la que peor está", () => {
    const e = eleccionPorFacultad(bloque, cuotas, plan, "", 15);
    expect(e.facultad).toBe(FACULTAD);
  });

  it("sin bloque devuelve un vacío que no revienta", () => {
    const e = eleccionPorFacultad(null, cuotas, plan, FACULTAD, 15);
    expect(e.facultades).toEqual([]);
    expect(e.cola).toEqual([]);
  });
});

/**
 * **«Nadie debe nada» sólo si se pudo mirar a alguien.**
 *
 * Medido el 2026-09-17 sobre el simulacro de CCSS por nivel: la pantalla
 * publicaba «ninguna facultad debe nada ahora mismo» con los cinco grupos del
 * motor sin evaluar, mientras Metas —misma sesión, mismos datos— decía que los
 * cuatro niveles no llegan y faltan 342 personas.
 *
 * La causa: `cuotaDeLaFacultad()` exige que la celda de cuota tenga SEXO
 * —descarta toda celda cuyo `kind` no sea `female` ni `male`— y una cuota por el
 * eje declarado no lo trae: sus celdas llegan con `sex = ""`. Toda esta
 * maquinaria supone cuota por sexo, y eso hay que DECIRLO en vez de publicar un
 * «todo bien».
 */
describe("eleccionPorFacultad: el denominador de la cola", () => {
  const bloqueDe = (nombres: string[]) => ({
    facultades: nombres.map((facultad) => ({ facultad })),
  } as never);

  it("cuenta los grupos y los que no tienen cuota que leer", () => {
    // Celdas del eje: sin sexo, que es el caso de una cuota por nivel.
    const sinSexo = [
      { faculty: "6", sex: "", target: 120, observed: 16, missing: 104 },
      { faculty: "7", sex: "", target: 121, observed: 18, missing: 103 },
    ];
    const e = eleccionPorFacultad(bloqueDe(["6", "7"]), sinSexo, [], "", 15);
    expect(e.grupos).toBe(2);
    expect(e.sinCuota).toBe(2);
    expect(e.evaluadas).toBe(0);
    expect(e.facultades).toHaveLength(0);
  });

  it("con celdas por sexo SÍ evalúa, y el conteo lo dice", () => {
    // La vara de que el arreglo no cambia nada para un estudio con cuota por
    // sexo: los dos grupos se evalúan y `sinCuota` queda en cero.
    const conSexo = [
      { faculty: "DERECHO", sex: "F", target: 100, observed: 40, missing: 60 },
      { faculty: "DERECHO", sex: "M", target: 100, observed: 30, missing: 70 },
    ];
    const e = eleccionPorFacultad(bloqueDe(["DERECHO"]), conSexo, [], "", 15);
    expect(e.grupos).toBe(1);
    expect(e.sinCuota).toBe(0);
    expect(e.evaluadas).toBe(1);
  });

  it("sin grupos del motor los contadores quedan en cero, no en NaN", () => {
    const e = eleccionPorFacultad(bloqueDe([]), [], [], "", 15);
    expect(e.grupos).toBe(0);
    expect(e.evaluadas).toBe(0);
    expect(e.sinCuota).toBe(0);
  });
});
