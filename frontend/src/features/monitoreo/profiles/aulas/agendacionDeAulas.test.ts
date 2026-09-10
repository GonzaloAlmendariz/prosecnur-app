import { describe, expect, it } from "vitest";
import { agendacionDeAulas } from "./agendacionDeAulas";
import type { MonitoreoRow } from "../../../../api/monitoreo";

const fila = (f: Partial<MonitoreoRow>) => ({ sample_role: "titular", ...f } as MonitoreoRow);

/** Los nombres son los reales de la agenda: `contact_date` y `scheduled_date`. */
const agenda = [
  fila({ faculty: "DERECHO", contact_date: "2026-09-01", scheduled_date: "2026-09-08" }),
  fila({ faculty: "DERECHO", contact_date: "2026-09-01", scheduled_date: "2026-09-09" }),
  fila({ faculty: "DERECHO", contact_date: "2026-09-09", scheduled_date: "2026-09-15" }),
  fila({ faculty: "PSICOLOGÍA", contact_date: "2026-09-09", scheduled_date: "" }),
  fila({ faculty: "PSICOLOGÍA", scheduled_date: "" }),
  fila({ faculty: "DERECHO", scheduled_date: "", sample_status: "rechazo" }),
  // Una reserva a la que nadie tocó NO se agenda hasta que hace falta: fuera.
  fila({ sample_role: "chain_reserve", faculty: "DERECHO", scheduled_date: "" }),
  // Ésta sí está en juego: se la contactó el 09 y todavía no da fecha.
  fila({ sample_role: "chain_reserve", faculty: "LETRAS", contact_date: "2026-09-09" }),
  // Y ésta ya tiene fecha de visita, sin que nadie apuntara cuándo se habló.
  fila({ sample_role: "chain_reserve", faculty: "LETRAS", scheduled_date: "2026-09-16" }),
];

describe("agendacionDeAulas", () => {
  it("cuenta sólo titulares: las reservas no se agendan", () => {
    expect(agendacionDeAulas(agenda).titulares).toBe(6);
  });

  it("separa lo que ya tiene fecha de visita de lo que falta", () => {
    const a = agendacionDeAulas(agenda);
    expect(a.conFecha).toBe(3);
    // Dos sin fecha; el rechazo NO cuenta como pendiente.
    expect(a.sinFecha).toBe(2);
  });

  it("separa al que no contesta del que nadie ha llamado", () => {
    // Gonzalo, 2026-09-10: «cuántos en contacto se tiene que aún no recibimos
    // respuesta». Insistir y empezar son dos trabajos distintos.
    const a = agendacionDeAulas(agenda);
    expect(a.reparto.enContacto).toBe(1);
    expect(a.reparto.sinContactar).toBe(1);
    expect(a.reparto.rechazos).toBe(1);
    expect(a.reparto.conFecha + a.reparto.enContacto + a.reparto.sinContactar + a.reparto.rechazos)
      .toBe(a.reparto.total);
  });

  it("las reservas EN JUEGO se cuentan aparte, no se pierden", () => {
    // Una reserva ya contactada o agendada es trabajo real; las intactas no.
    const a = agendacionDeAulas(agenda);
    expect(a.reemplazos.total).toBe(2);
    expect(a.reemplazos.conFecha).toBe(1);
    expect(a.reemplazos.enContacto).toBe(1);
  });

  it("avisa de los agendados sin fecha de contacto: no salen en las barras", () => {
    // Si esto crece, el ritmo dibujado va por debajo del real.
    expect(agendacionDeAulas(agenda).sinDiaDeContacto).toBe(1);
  });

  it("un rechazo no es trabajo pendiente de agendar", () => {
    // Su desenlace ya ocurrió: contarlo pediría un trabajo que nadie va a hacer.
    const a = agendacionDeAulas(agenda);
    expect(a.faltanPorFacultad.find((f) => f.facultad === "DERECHO")).toBeUndefined();
  });

  it("el ritmo sale de CUÁNDO SE AGENDÓ, no de cuándo se visita", () => {
    // `contact_date` es hablar con el docente; `scheduled_date`, ir al aula.
    // Mezclarlas daría el calendario de visitas disfrazado de ritmo.
    const a = agendacionDeAulas(agenda);
    // Dos el 01 y dos el 09: la quinta y la sexta fila no traen `contact_date`
    // y la séptima es reserva. (Conté tres al escribirlo; el fixture manda.)
    expect(a.porDia).toEqual([
      { fecha: "2026-09-01", aulas: 2, titulares: 2, reemplazos: 0 },
      { fecha: "2026-09-09", aulas: 3, titulares: 2, reemplazos: 1 },
    ]);
  });

  it("los últimos días son los que TUVIERON actividad", () => {
    // Un fin de semana sin agendar hundiría el ritmo con ceros que nadie trabajó.
    const a = agendacionDeAulas(agenda, { ultimos: 1 });
    expect(a.ultimosDias).toBe(1);
    // Los tres del 09: dos titulares y la reserva que se puso en juego.
    expect(a.ultimosAulas).toBe(3);
  });

  it("dice hasta qué día llega lo agendado, contando los reemplazos", () => {
    // El 16 es la visita de una reserva ya activada: el plan de campo llega
    // hasta ahí, y mirar sólo a los titulares lo dejaría corto.
    expect(agendacionDeAulas(agenda).hasta).toBe("2026-09-16");
  });

  it("las que faltan se ordenan por cuántas, y nombran su facultad", () => {
    expect(agendacionDeAulas(agenda).faltanPorFacultad).toEqual([
      { facultad: "PSICOLOGÍA", aulas: 2 },
    ]);
  });

  it("sin agenda no inventa un estado", () => {
    expect(agendacionDeAulas([]).titulares).toBe(0);
    expect(agendacionDeAulas(null).porDia).toEqual([]);
  });
});

describe("los reemplazos que ya están en juego", () => {
  /**
   * Gonzalo, ítem 5 del dictado: «tampoco me estás diciendo cuántos reemplazos
   * ya se aplicaron y qué tipo de reemplazos».
   *
   * En el corte del 2026-09-10 la respuesta es: cuatro activados —los cuatro
   * rechazos de titulares—, todos de la misma celda, y CERO aplicados.
   */
  const conRelevos = [
    fila({ faculty: "DERECHO", sample_status: "rechazo", scheduled_date: "", contact_date: "2026-09-03" }),
    fila({
      sample_role: "chain_reserve", faculty: "DERECHO", contact_date: "2026-09-09",
      equivalence_level: "misma_celda", titular_operational_code: "CH 90",
    }),
    fila({
      sample_role: "chain_reserve", faculty: "LETRAS", scheduled_date: "2026-09-16",
      equivalence_level: "reserva_extra", titular_operational_code: "CH 12",
      replacement_reason: "El docente rechazó", applied_surveys: "18",
    }),
  ];

  it("dice de qué tipo es cada relevo, del más parecido al menos", () => {
    const a = agendacionDeAulas(conRelevos);
    expect(a.activados.porEquivalencia.map((e) => [e.nivel, e.aulas])).toEqual([
      ["misma_celda", 1],
      ["reserva_extra", 1],
    ]);
    expect(a.activados.porEquivalencia[0].palabras).toBe("del mismo perfil que el titular");
  });

  it("aplicado es haber ido, no tener fecha", () => {
    expect(agendacionDeAulas(conRelevos).activados.aplicados).toBe(1);
  });

  it("dice a qué titulares cubren", () => {
    expect(agendacionDeAulas(conRelevos).activados.cubren).toEqual(["CH 12", "CH 90"]);
  });

  it("cuenta los que no declaran motivo: sin él nadie sabrá por qué se activó", () => {
    expect(agendacionDeAulas(conRelevos).activados.sinMotivo).toBe(1);
  });

  it("un nivel que el sorteo no conoce no se traga en silencio", () => {
    const raro = [fila({ sample_role: "chain_reserve", contact_date: "2026-09-09", equivalence_level: "vecindad_3" })];
    expect(agendacionDeAulas(raro).activados.porEquivalencia[0].palabras).toBe("vecindad_3");
  });
});
