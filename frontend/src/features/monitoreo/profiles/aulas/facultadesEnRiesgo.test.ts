import { describe, expect, it } from "vitest";

import { cierreDeLaFacultad, facultadesEnRiesgo } from "./facultadesEnRiesgo";
import type { MonitoreoAulasEfectividadSeguimiento, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * «Si en Gestión falta y estamos por debajo de lo esperado, ¿por qué no se
 * notifica aquí, o ni siquiera aparece esa facultad?» (Gonzalo, 2026-09-11).
 *
 * El fixture reproduce los tres casos medidos en HSVG26ULT2 ese día: la que
 * tiene campo pero no llega con lo agendado, la que no tiene campo y sí tiene
 * fechas, y la que va sobrada y no debe aparecer.
 */
const bloque = {
  total: {},
  facultades: [
    // Con cifras del motor: son las que mandan.
    { facultad: "GESTIÓN", faculty_key: "gestion", aulas_aplicadas: 1, reservas_libres: 42,
      cuota: 60, conseguido: 10, cursos_agendados: 2, proyectado_agendado: 34,
      margen_agendado: -26, riesgo_agendado: "riesgo" },
    // Sin campo: el motor no proyecta y el panel estima con su τ prevista.
    { facultad: "CONTABLES", faculty_key: "contables", aulas_aplicadas: 0, reservas_libres: 7,
      cuota: 20, conseguido: 0, cursos_agendados: 3, elegibles_agendados: 59,
      tau_previsto: 0.6453, proyectado_agendado: null, margen_agendado: null,
      riesgo_agendado: "sin_campo", cursos_sin_agendar: 4 },
    { facultad: "EDUCACION", faculty_key: "educacion", aulas_aplicadas: 0, reservas_libres: 14 },
    { facultad: "DERECHO", faculty_key: "derecho", aulas_aplicadas: 6, reservas_libres: 207 },
    // Poco campo, pero su cuota ya está cerrada: no medirse no le cuesta nada.
    { facultad: "CUBIERTA", faculty_key: "cubierta", aulas_aplicadas: 1, reservas_libres: 3 },
    // Poco campo y le falta poco, con mucho de sobra en camino.
    { facultad: "HOLGADA", faculty_key: "holgada", aulas_aplicadas: 1, reservas_libres: 9 },
  ],
} as unknown as MonitoreoAulasEfectividadSeguimiento;

const cuota = (faculty: string, sex_key: string, target: number, achieved: number) =>
  ({ faculty, sex_key, target, achieved, missing: Math.max(0, target - achieved) });

const celdas = [
  // Gestión: pide 60 y lleva 10; lo agendado no le va a alcanzar.
  cuota("GESTIÓN", "F", 30, 5), cuota("GESTIÓN", "M", 30, 5),
  cuota("CONTABLES", "F", 10, 0), cuota("CONTABLES", "M", 10, 0),
  cuota("EDUCACION", "F", 12, 0), cuota("EDUCACION", "M", 12, 0),
  // Derecho ya cubrió lo suyo: no es un riesgo y no entra.
  cuota("DERECHO", "F", 10, 10), cuota("DERECHO", "M", 10, 10),
  cuota("CUBIERTA", "F", 6, 6), cuota("CUBIERTA", "M", 6, 6),
  cuota("HOLGADA", "F", 6, 5), cuota("HOLGADA", "M", 6, 5),
];

const aula = (faculty: string, code: string, fecha: string, eligible: number) => ({
  faculty, operational_code: code, sample_role: "titular",
  scheduled_date: fecha, operational_status: "planificada", sample_status: "agendada",
  eligible_n: eligible, sex_top_1: "F", sex_top_1_n: Math.round(eligible / 2),
  sex_top_2: "M", sex_top_2_n: eligible - Math.round(eligible / 2),
  tasa_facultad: 0.5, respuestas_validas: 0,
});

const plan = [
  aula("GESTIÓN", "CH 137", "2026-09-12", 30),
  aula("GESTIÓN", "CH 138", "2026-09-14", 20),
  aula("CONTABLES", "CH 167", "2026-09-14", 30),
  aula("CONTABLES", "CH 165", "2026-09-17", 20),
  // Educación no tiene NADA agendado: es el caso que urge.
  { ...aula("EDUCACION", "CH 162", "", 30), sample_status: "", operational_status: "planificada" },
  aula("DERECHO", "CH 1", "2026-09-14", 40),
  aula("CUBIERTA", "CH 2", "2026-09-14", 20),
  aula("HOLGADA", "CH 3", "2026-09-14", 40),
] as unknown as MonitoreoAulasPlanRow[];

describe("las facultades en riesgo que el ranking de tasas no ve", () => {
  it("nombra a la que no llega con lo agendado aunque tenga poco campo", () => {
    // Gestión tiene UN curso-horario aplicado: el ranking de rendimiento la
    // aparta por no llegar al mínimo para comparar y no la menciona.
    const filas = facultadesEnRiesgo(bloque, celdas, plan);
    const g = filas.find((f) => f.clave === "gestion")!;
    expect(g.aviso).toBe("agenda_corta");
    expect(g.reservasLibres).toBe(42);
    // **Las cifras salen del MOTOR, no de una segunda fórmula en TypeScript.**
    // `proyectado_agendado` 34 sobre lo conseguido 10 son 24 en camino, y su
    // `margen_agendado` −26 es lo que faltaría. Que coincidan con lo que el
    // respaldo daba no es casualidad: es la misma cuenta, hecha una sola vez.
    expect(g.medido).toBe(true);
    expect(g.cursosEnCamino).toBe(2);
    expect(g.enCamino).toBe(24);
    expect(g.quedaria).toBe(26);
  });

  it("si el motor no proyecta —facultad sin campo— la cifra se marca como estimada", () => {
    // ADR 0082: sin campo el motor NO cae a la τ prevista, porque eso publica el
    // supuesto como medición. El panel estima igual con el aforo que SÍ publica
    // el motor, y lo dice. Antes caía a cero: «esperan traer 0» con 59 citados.
    const c = facultadesEnRiesgo(bloque, celdas, plan).find((f) => f.clave === "contables")!;
    expect(c.medido).toBe(false);
    expect(c.cursosEnCamino).toBe(3);
    // 59 elegibles citados por su τ prevista de 0,6453.
    expect(c.enCamino).toBe(38);
    expect(c.quedaria).toBe(0);
  });

  it("la que no tiene campo pero sí fechas se avisa como sin medir, no como corta", () => {
    const c = facultadesEnRiesgo(bloque, celdas, plan).find((f) => f.clave === "contables")!;
    expect(c.aviso).toBe("a_ciegas");
    // Sus 25 esperadas cubren los 20 que pide: el riesgo no es la cuota, es que
    // no hay tasa propia con la que saber si esas 25 van a aparecer.
    expect(c.quedaria).toBe(0);
    expect(c.proximaFecha).toBe("2026-09-14");
  });

  it("la que no tiene campo NI fechas se queda sin próxima fecha", () => {
    // Es el caso que urge de verdad: nadie va a medirla si no se activa una
    // reserva, y el panel lo tiene que poder decir.
    const e = facultadesEnRiesgo(bloque, celdas, plan).find((f) => f.clave === "educacion")!;
    expect(e.proximaFecha).toBe("");
    expect(e.cursosEnCamino).toBe(0);
    // Y sale como corta, porque sin nada agendado su cuota entera está en pie.
    expect(e.aviso).toBe("agenda_corta");
    expect(e.quedaria).toBe(24);
  });

  it("la que va cubierta y con campo no aparece: un aviso que lista a todas no avisa", () => {
    expect(facultadesEnRiesgo(bloque, celdas, plan).some((f) => f.clave === "derecho")).toBe(false);
  });

  it("la agenda corta va primero y por tamaño, que es lo que se puede mover hoy", () => {
    expect(facultadesEnRiesgo(bloque, celdas, plan).map((f) => f.clave))
      .toEqual(["gestion", "educacion", "contables"]);
  });

  it("no avisa de la que tiene poco campo y la cuota ya cerrada", () => {
    // Medido el 2026-09-11: el panel avisaba de Educación con 24 de 24
    // respuestas. No poder medirse sólo importa si hay algo en juego.
    expect(facultadesEnRiesgo(bloque, celdas, plan).some((f) => f.clave === "cubierta")).toBe(false);
  });

  it("no avisa de la que debe poco y tiene mucho de sobra en camino", () => {
    // Gastronomía: le faltaban 2 y traía 21. Incluirla diluye el aviso.
    expect(facultadesEnRiesgo(bloque, celdas, plan).some((f) => f.clave === "holgada")).toBe(false);
  });

  it("la que nunca se ha medido entra aunque lo agendado le sobre", () => {
    // Contables trae 35 para los 20 que faltan y aun así entra: nada de lo que
    // se le prevé está comprobado en esa facultad.
    const c = facultadesEnRiesgo(bloque, celdas, plan).find((f) => f.clave === "contables")!;
    expect(c.aplicados).toBe(0);
    expect(c.enCamino).toBeGreaterThan(c.falta);
  });

  it("sin bloque no inventa avisos", () => {
    expect(facultadesEnRiesgo(null, celdas, plan)).toEqual([]);
  });
});

/**
 * «Por un lado a Derecho no le va mal y por otro a Derecho le falta muchísimo
 * […] sospecho que en gran parte es porque nos falta agendar […] pero ninguno
 * se complementa ni me dice si aquello es necesario» (Gonzalo, 2026-09-11).
 */
describe("agendar y reforzar son dos acciones y el motor dice cuál toca", () => {
  const facultad = (sobre: Record<string, unknown>) => ({
    facultad: "DERECHO", faculty_key: "derecho", aulas_aplicadas: 7,
    cuota: 363, conseguido: 147, cursos_agendados: 6, proyectado_agendado: 272,
    margen_agendado: -91, riesgo_agendado: "riesgo", cursos_sin_agendar: 17,
    margen_restante: 207, ...sobre,
  }) as unknown as Parameters<typeof cierreDeLaFacultad>[0];

  it("rinde bien y está corta de campo: toca agendar, no gastar reserva", () => {
    // El caso real de Derecho. Con todo su plan proyecta de sobra (+207) y con
    // lo agendado se queda a 91: el aforo existe, lo que falta es fecha.
    const c = cierreDeLaFacultad(facultad({}))!;
    expect(c.loQueToca).toBe("agendar");
    expect(c.falta).toBe(216);
    expect(c.enCamino).toBe(125);
    expect(c.quedaria).toBe(91);
    expect(c.cursosSinAgendar).toBe(17);
  });

  it("cuando ni su plan entero alcanza, toca refuerzo", () => {
    // Ahí sí corresponde contactar docentes de aulas de refuerzo: una reserva
    // gastada no vuelve y no se comparte entre facultades.
    expect(cierreDeLaFacultad(facultad({ margen_restante: -40 }))!.loQueToca).toBe("reforzar");
  });

  it("la que ya cierra con lo agendado no pide ninguna de las dos", () => {
    expect(cierreDeLaFacultad(facultad({ margen_agendado: 12 }))!.loQueToca).toBeNull();
  });

  it("las dos lecturas salen de la MISMA cuenta", () => {
    // El panel de Resumen y la ficha de Brechas leen `cierreDeLaFacultad`: es lo
    // que evita que una diga «va bien» y la otra «le falta muchísimo» sin que
    // ninguna explique por qué.
    const bloqueDerecho = {
      total: {}, facultades: [facultad({ reservas_libres: 207 })],
    } as unknown as Parameters<typeof facultadesEnRiesgo>[0];
    const delPanel = facultadesEnRiesgo(bloqueDerecho, [], [])[0];
    const deLaFicha = cierreDeLaFacultad(facultad({}))!;
    expect(delPanel.quedaria).toBe(deLaFicha.quedaria);
    expect(delPanel.enCamino).toBe(deLaFicha.enCamino);
    expect(delPanel.loQueToca).toBe(deLaFicha.loQueToca);
  });
});
