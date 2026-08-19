import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;
const aula = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;
const cuota = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

/** Diez aulas ya aplicadas a 20 encuestas: el esperado queda pegado a 20. */
const historia = Array.from({ length: 10 }, (_, i) => parte({
  operational_code: `CH ${i}`,
  faculty: "Derecho",
  applied_at: "2026-08-10",
  effective_surveys: 20,
}));

describe("proyeccionPorAgenda", () => {
  it("proyecta sobre las aulas agendadas, no sobre un ritmo", () => {
    const agenda = [
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11" }),
      aula({ operational_code: "CH 91", faculty: "Derecho", scheduled_date: "2026-08-12" }),
    ];
    const [d] = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 30, observed: 10 }),
      cuota({ faculty: "Derecho", sex: "Hombre", target: 30, observed: 10 }),
    ]);
    expect(d.aulasAgendadas).toBe(2);
    expect(d.dias.map((x) => x.fecha)).toEqual(["2026-08-11", "2026-08-12"]);
    // Dos aulas a ~20 encuestas cada una, repartidas mitad y mitad.
    expect(d.esperadoPorAula).toBeGreaterThan(15);
    expect(d.cuotas.every((c) => c.alcanza)).toBe(true);
  });

  it("un aula que ya tiene parte no se vuelve a contar", () => {
    // Es la trampa evidente: la misma aula está en la agenda Y en el parte.
    const agenda = [aula({ operational_code: "CH 0", faculty: "Derecho", scheduled_date: "2026-08-20" })];
    // Con una cuota para que la facultad exista en la salida: sin agenda futura
    // NI cuotas, una facultad no tiene nada que decir y no aparece —lo comprueba
    // el aserto de abajo—.
    const [d] = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 10, observed: 0 }),
    ]);
    expect(d.aulasAgendadas).toBe(0);
    expect(proyeccionPorAgenda(agenda, historia, [])).toEqual([]);
  });

  it("lo agendado para el día del último parte o antes ya ocurrió", () => {
    const agenda = [
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-10" }),
      aula({ operational_code: "CH 91", faculty: "Derecho", scheduled_date: "2026-08-09" }),
      aula({ operational_code: "CH 92", faculty: "Derecho", scheduled_date: "2026-08-11" }),
    ];
    const [d] = proyeccionPorAgenda(agenda, historia, []);
    expect(d.aulasAgendadas).toBe(1);
  });

  it("una reserva dormida no es agenda, aunque lleve fecha", () => {
    // `dashboard.agenda` es el PLAN ENTERO, y el banco de extras viene con
    // fecha puesta. Contarlo como trabajo comprometido proyectaba encuestas que
    // nadie iba a recoger y tapaba justo la brecha que esto sirve para ver:
    // sembrar 30 extras mas en una facultad le bajaba la brecha de 152 a 81.
    const agenda = [
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11", sample_status: "agendada" }),
      aula({ operational_code: "EXTRA 1", faculty: "Derecho", scheduled_date: "2026-08-12", sample_role: "extra_reserve_pool", sample_status: "en_reserva" }),
      aula({ operational_code: "R 1.1", faculty: "Derecho", scheduled_date: "2026-08-13", sample_role: "chain_reserve", sample_status: "en reserva 3" }),
    ];
    const [d] = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 300, observed: 0 }),
    ]);
    expect(d.aulasAgendadas).toBe(1);
    expect(d.dias.map((x) => x.fecha)).toEqual(["2026-08-11"]);
  });

  it("un titular ya reemplazado tampoco: esa aula se cayó", () => {
    const agenda = [
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11", sample_status: "reemplazada" }),
      aula({ operational_code: "CH 91", faculty: "Derecho", scheduled_date: "2026-08-12", sample_status: "agendada" }),
    ];
    const [d] = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 300, observed: 0 }),
    ]);
    expect(d.aulasAgendadas).toBe(1);
  });

  it("un estado que nadie previó SÍ cuenta: la lista es de exclusión", () => {
    // Una lista cerrada de estados «buenos» se traga en silencio lo que no
    // reconoce. Con un allow-list de `agendada`, un estudio que usara
    // `contactada` proyectaría cero sin avisar de nada.
    const agenda = [
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11", sample_status: "contactada" }),
      aula({ operational_code: "CH 91", faculty: "Derecho", scheduled_date: "2026-08-12" }),
    ];
    const [d] = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 300, observed: 0 }),
    ]);
    expect(d.aulasAgendadas).toBe(2);
  });

  it("dice el día en que se cruzaría la meta de cada sexo", () => {
    const agenda = Array.from({ length: 4 }, (_, i) => aula({
      operational_code: `CH 9${i}`,
      faculty: "Derecho",
      scheduled_date: `2026-08-1${i + 1}`,
    }));
    const [d] = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 40, observed: 20 }),
      cuota({ faculty: "Derecho", sex: "Hombre", target: 25, observed: 20 }),
    ]);
    const mujer = d.cuotas.find((c) => c.sexo === "Mujer")!;
    const hombre = d.cuotas.find((c) => c.sexo === "Hombre")!;
    // A Hombre le faltan 5 y a Mujer 20: Hombre cruza antes.
    expect(hombre.fechaDeCruce).not.toBeNull();
    expect(mujer.fechaDeCruce).not.toBeNull();
    expect(hombre.fechaDeCruce! <= mujer.fechaDeCruce!).toBe(true);
  });

  it("NO inventa una fecha cuando la agenda no alcanza", () => {
    // Lo que pidió Gonzalo que se pudiera ver: «si lo que tengo agendado ya es
    // suficiente para llegar a esa meta o no». Con una sola aula y 200 por
    // cubrir, la respuesta honesta es que no, y cuánto seguiría faltando.
    const agenda = [aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11" })];
    const [d] = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 200, observed: 0 }),
    ]);
    const mujer = d.cuotas[0];
    expect(mujer.alcanza).toBe(false);
    expect(mujer.fechaDeCruce).toBeNull();
    expect(mujer.faltanAlCerrarAgenda).toBeGreaterThan(150);
  });

  it("una facultad sin agenda no alcanza nada, y lo dice", () => {
    const [d] = proyeccionPorAgenda([], historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 50, observed: 10 }),
    ]);
    expect(d.aulasAgendadas).toBe(0);
    expect(d.dias).toEqual([]);
    expect(d.cuotas[0].alcanza).toBe(false);
    expect(d.cuotas[0].faltanAlCerrarAgenda).toBe(40);
  });

  it("una cuota ya cumplida no pide fecha de cruce", () => {
    const agenda = [aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11" })];
    const [d] = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 10, observed: 12 }),
    ]);
    expect(d.cuotas[0].faltan).toBe(0);
    expect(d.cuotas[0].alcanza).toBe(true);
    expect(d.cuotas[0].fechaDeCruce).toBeNull();
  });

  it("declara si el reparto por sexo salió de lo observado o de la meta", () => {
    const agenda = [aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11" })];
    const conRespuestas = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 30, observed: 8 }),
      cuota({ faculty: "Derecho", sex: "Hombre", target: 30, observed: 2 }),
    ]);
    expect(conRespuestas[0].reparto).toBe("observada");

    const sinRespuestas = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Derecho", sex: "Mujer", target: 30, observed: 0 }),
      cuota({ faculty: "Derecho", sex: "Hombre", target: 10, observed: 0 }),
    ]);
    // Sin nadie observado no hay proporción propia: se usa la de la meta y se
    // dice, porque es un supuesto más frágil que el otro.
    expect(sinRespuestas[0].reparto).toBe("meta");
  });

  it("primero las facultades que NO llegan con lo agendado", () => {
    const agenda = [
      aula({ operational_code: "A1", faculty: "Holgada", scheduled_date: "2026-08-11" }),
      aula({ operational_code: "B1", faculty: "Apretada", scheduled_date: "2026-08-11" }),
    ];
    const res = proyeccionPorAgenda(agenda, historia, [
      cuota({ faculty: "Holgada", sex: "Mujer", target: 5, observed: 5 }),
      cuota({ faculty: "Apretada", sex: "Mujer", target: 500, observed: 0 }),
    ]);
    expect(res[0].facultad).toBe("Apretada");
  });
});

describe("los elegibles son el techo del día, y van aparte", () => {
  // «Si agendamos tres aulas y se tiene previsto que haya cien elegibles, pero
  // por los criterios que hemos ido calculando se prevén sesenta, eso hay que
  // mostrarlo.» La distancia entre las dos cifras ES la efectividad prevista.
  it("suma los elegibles de las aulas de cada día", () => {
    const agenda = [
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11", eligible_n: 40 }),
      aula({ operational_code: "CH 91", faculty: "Derecho", scheduled_date: "2026-08-11", eligible_n: 60 }),
      aula({ operational_code: "CH 92", faculty: "Derecho", scheduled_date: "2026-08-12", eligible_n: 30 }),
    ];
    const [d] = proyeccionPorAgenda(agenda, historia, []);
    expect(d.dias.map((x) => [x.fecha, x.aulas, x.elegibles])).toEqual([
      ["2026-08-11", 2, 100],
      ["2026-08-12", 1, 30],
    ]);
  });

  it("lo esperado va por debajo de los elegibles, que es el punto", () => {
    const agenda = [
      aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11", eligible_n: 100 }),
    ];
    const [d] = proyeccionPorAgenda(agenda, historia, []);
    // La historia rinde ~20 por aula sobre aulas de 100 elegibles: se espera muy
    // por debajo del techo, y eso es informacion, no un error.
    expect(d.dias[0].esperadas).toBeLessThan(d.dias[0].elegibles);
  });

  it("un aula sin elegibles declarados no inventa un techo", () => {
    const agenda = [aula({ operational_code: "CH 90", faculty: "Derecho", scheduled_date: "2026-08-11" })];
    const [d] = proyeccionPorAgenda(agenda, historia, []);
    expect(d.dias[0].elegibles).toBe(0);
  });
});
