import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { agendaPorDia, etiquetaDeFecha, fechaIsoReal } from "./agendaPorDia";

/**
 * La sección se llama Agenda y no se podía leer como agenda.
 *
 * Cuándo se aplica cada curso-horario vive en el plan —`FECHA DE APLICACION`—
 * y sólo se veía recorriendo 196 filas: ni cuántos días dura el campo, ni qué
 * día está cargado, ni si lo de mañana ya recogió algo.
 */

function aula(fecha: string, estado = "lista", dia?: string): MonitoreoAulasPlanRow {
  return {
    operational_code: `CH ${fecha}${estado}${dia ?? ""}`,
    scheduled_date: fecha,
    scheduled_day: dia,
    application_state: estado,
  } as unknown as MonitoreoAulasPlanRow;
}

describe("la agenda por día", () => {
  it("ordena los días por fecha", () => {
    const res = agendaPorDia([aula("2026-08-12"), aula("2026-08-10"), aula("2026-08-11")]);
    expect(res.dias.map((d) => d.fecha)).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
    expect(res.diasDeCampo).toBe(3);
  });

  it("las que no tienen fecha no se descartan, van al final", () => {
    // Un aula sin fecha es justo la que nadie va a aplicar mañana: esconderla
    // sería esconder el problema.
    const res = agendaPorDia([aula(""), aula("2026-08-10")]);
    expect(res.dias.map((d) => d.fecha)).toEqual(["2026-08-10", ""]);
    expect(res.sinFecha).toBe(1);
    expect(res.dias[1].etiqueta).toBe("Sin fecha agendada");
  });

  it("nombra el día desde la FECHA, no desde la columna del libro", () => {
    // El 10/08/2026 es lunes. Si la columna DIA dijera «Viernes» —escrita a
    // mano y equivocada—, el grupo diría un día y contendría otro.
    const res = agendaPorDia([aula("2026-08-10", "lista", "Viernes")]);
    expect(res.dias[0].etiqueta).toBe("Lunes 10/08");
  });

  it("un estado que el motor no declare se cuenta aparte", () => {
    // Misma salida declarada que en Avance: no desaparece del reparto.
    const res = agendaPorDia([aula("2026-08-10", "flamante")]);
    const sinClasificar = res.dias[0].tramos.find((t) => t.clave === "desconocido");
    expect(sinClasificar?.aulas).toBe(1);
    expect(res.dias[0].aulas).toBe(1);
  });

  it("el día más cargado marca la escala", () => {
    const res = agendaPorDia([
      aula("2026-08-10"), aula("2026-08-10"), aula("2026-08-10"),
      aula("2026-08-11"),
    ]);
    expect(res.tope).toBe(3);
  });

  it("separa lo que ya se aplicó de lo que no ha empezado", () => {
    // `cerrando` y `en_aplicacion` son la MISMA cosa desde el 2026-09-10: al
    // curso-horario se va una sola vez. Las dos claves del motor caen en el
    // tramo `aplicado`, y esta cuenta las recoge por igual.
    const res = agendaPorDia([
      aula("2026-08-10", "cerrando"),
      aula("2026-08-10", "lista"),
      aula("2026-08-10", "pendiente"),
    ]);
    expect(res.dias[0].cumplen).toBe(1);
    // Y con la otra clave del motor cuenta lo mismo: si mirara una sola, esta
    // cuenta caería a cero en cuanto el motor prefiriera la otra.
    expect(agendaPorDia([aula("2026-08-10", "en_aplicacion")]).dias[0].cumplen).toBe(1);
    // Sin agendar más agendadas: las dos que todavía no recibieron respuestas.
    expect(res.dias[0].sinEmpezar).toBe(2);
  });
});

describe("etiquetaDeFecha", () => {
  it("compone el dia de la semana desde la fecha", () => {
    expect(etiquetaDeFecha("2026-09-14")).toBe("Lunes 14/09");
    expect(etiquetaDeFecha("2026-09-20")).toBe("Domingo 20/09");
    expect(etiquetaDeFecha("")).toBe("Sin fecha agendada");
  });

  it("una fecha IMPOSIBLE se devuelve cruda, sin inventarle dia de la semana", () => {
    // `Date.UTC(2026, 8, 31)` no falla: corre al 1 de octubre y devuelve un
    // instante valido, asi que `Number.isNaN` no lo caza. El numero salia del
    // texto crudo y el nombre de la fecha corrida: «Jueves 31/09», un dia de la
    // semana de otra fecha pegado a una que no existe.
    expect(etiquetaDeFecha("2026-09-31")).toBe("2026-09-31");
    expect(etiquetaDeFecha("2026-02-30")).toBe("2026-02-30");
    expect(etiquetaDeFecha("2026-13-01")).toBe("2026-13-01");
  });

  it("el 29 de febrero existe en bisiesto y no en el resto", () => {
    expect(etiquetaDeFecha("2028-02-29")).toBe("Martes 29/02");
    expect(etiquetaDeFecha("2026-02-29")).toBe("2026-02-29");
  });
});

describe("fechaIsoReal", () => {
  it("acepta lo que existe y rechaza lo que no", () => {
    expect(fechaIsoReal("2026-09-14")?.dia).toBe(14);
    expect(fechaIsoReal("2026-09-31")).toBeNull();
    expect(fechaIsoReal("")).toBeNull();
    expect(fechaIsoReal("no-es-fecha")).toBeNull();
  });
});
