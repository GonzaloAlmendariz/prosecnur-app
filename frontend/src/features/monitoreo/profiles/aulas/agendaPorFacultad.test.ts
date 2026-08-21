import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { agendaPorFacultad } from "./agendaPorFacultad";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("agendaPorFacultad", () => {
  it("dentro de la facultad, en el orden en que hay que ir", () => {
    const [f] = agendaPorFacultad([
      fila({ operational_code: "CH 2", faculty: "Derecho", scheduled_date: "2026-08-12", scheduled_time: "10:00" }),
      fila({ operational_code: "CH 1", faculty: "Derecho", scheduled_date: "2026-08-10", scheduled_time: "16:00" }),
      fila({ operational_code: "CH 3", faculty: "Derecho", scheduled_date: "2026-08-10", scheduled_time: "08:00" }),
    ]);
    expect(f.aulas.map((a) => a.codigo)).toEqual(["CH 3", "CH 1", "CH 2"]);
  });

  it("un aula sin fecha va al FINAL de su facultad, no al principio", () => {
    // Ordenando por cadena, «» es la menor y encabezaría el grupo: la vista
    // abriría por lo único que no se puede planificar.
    const [f] = agendaPorFacultad([
      fila({ operational_code: "SIN", faculty: "Letras" }),
      fila({ operational_code: "CON", faculty: "Letras", scheduled_date: "2026-08-11" }),
    ]);
    expect(f.aulas.map((a) => a.codigo)).toEqual(["CON", "SIN"]);
    expect(f.primeraFecha).toBe("2026-08-11");
  });

  it("las facultades por el día en que empiezan", () => {
    const salida = agendaPorFacultad([
      fila({ operational_code: "A", faculty: "Tarde", scheduled_date: "2026-08-20" }),
      fila({ operational_code: "B", faculty: "Temprano", scheduled_date: "2026-08-10" }),
    ]);
    expect(salida.map((f) => f.facultad)).toEqual(["Temprano", "Tarde"]);
  });

  it("una facultad entera sin fechas va al final", () => {
    const salida = agendaPorFacultad([
      fila({ operational_code: "A", faculty: "SinFecha" }),
      fila({ operational_code: "B", faculty: "ConFecha", scheduled_date: "2026-08-20" }),
    ]);
    expect(salida.map((f) => f.facultad)).toEqual(["ConFecha", "SinFecha"]);
  });

  it("lleva la observación de quien agendó", () => {
    // Viaja en `replacement_note` —el motor acepta ahí la columna OBSERVACIONES
    // del libro— y hasta ahora no la pedía ninguna superficie: el dato llegaba,
    // tenía rótulo y no se veía en ninguna parte.
    const [f] = agendaPorFacultad([
      fila({
        operational_code: "CH 1", faculty: "Derecho", scheduled_date: "2026-08-10",
        replacement_note: "El docente pide llegar 10 min antes",
      } as Partial<MonitoreoAulasPlanRow>),
      fila({ operational_code: "CH 2", faculty: "Derecho", scheduled_date: "2026-08-11" }),
    ]);
    expect(f.aulas[0].nota).toBe("El docente pide llegar 10 min antes");
    // Sin nota es cadena vacía, no `undefined`: la vista pregunta por verdad.
    expect(f.aulas[1].nota).toBe("");
  });

  it("«en marcha» son las que ya no están sólo planificadas", () => {
    const [f] = agendaPorFacultad([
      fila({ operational_code: "A", faculty: "X", operational_status: "aplicada" }),
      fila({ operational_code: "B", faculty: "X", operational_status: "planificada" }),
      // Sin estado declarado se cuenta como planificada, igual que en el resto
      // del perfil: es el valor por defecto del motor.
      fila({ operational_code: "C", faculty: "X" }),
    ]);
    expect(f.enMarcha).toBe(1);
    expect(f.aulas).toHaveLength(3);
  });
  it("dice que una reserva es una reserva y a quien reemplaza", () => {
    // En la lista de su facultad un `R 21.1` aparecia junto a `CH 21` y nada
    // decia que lo estuviera reemplazando: la relacion habia que adivinarla por
    // el numero.
    const [facultad] = agendaPorFacultad([
      fila({ operational_code: "CH 21", faculty: "Letras", scheduled_date: "2026-08-12", sample_role: "titular" }),
      fila({
        operational_code: "R 21.1", faculty: "Letras", scheduled_date: "2026-08-10",
        sample_role: "chain_reserve", titular_operational_code: "CH 21",
      }),
    ]);
    const reserva = facultad.aulas.find((a) => a.codigo === "R 21.1");
    const titular = facultad.aulas.find((a) => a.codigo === "CH 21");
    expect(reserva?.esReserva).toBe(true);
    expect(reserva?.titular).toBe("CH 21");
    // Y el titular no se marca como reserva, que es la otra mitad del aserto.
    expect(titular?.esReserva).toBe(false);
    expect(titular?.titular).toBe("");
  });

  it("una fila sin rol declarado NO se da por reserva", () => {
    // Medido en el plan real: los roles son `titular`, `chain_reserve` y
    // `extra_reserve_pool`, asi que «no es titular» y «es reserva» coinciden
    // ahi y un aserto sobre esos datos no distingue las dos reglas. Una fila
    // sin rol —el libro puede no traer la columna— si las separa: no saber que
    // algo es una reserva no es saber que lo es.
    const [facultad] = agendaPorFacultad([
      fila({ operational_code: "CH 5", faculty: "X", scheduled_date: "2026-08-11" }),
    ]);
    expect(facultad.aulas[0].esReserva).toBe(false);
  });

  it("una reserva sin titular declarado se marca igual, sin inventarle uno", () => {
    const [facultad] = agendaPorFacultad([
      fila({ operational_code: "R 9.1", faculty: "X", sample_role: "chain_reserve" }),
    ]);
    expect(facultad.aulas[0].esReserva).toBe(true);
    expect(facultad.aulas[0].titular).toBe("");
  });
});
