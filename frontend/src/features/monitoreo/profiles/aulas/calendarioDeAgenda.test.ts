// calendarioDeAgenda.test.ts — de la lista de días a la cuadrícula de
// calendario (dictado de Gonzalo 2026-09-01: «que… el calendario de CHs a
// agendar se vea mejor»).
//
// El agregado por día NO se recalcula: entra el `dias` que ya produce
// `agendaPorDia` —fecha, aulas, sin empezar— y este helper sólo lo coloca en
// semanas de lunes a domingo. Reescribir el conteo aquí sería tener dos dueños
// del mismo número, que es el tropiezo que la leyenda de tramos ya pagó.
import { describe, expect, it } from "vitest";

import { calendarioDeAgenda } from "./calendarioDeAgenda";
import type { DiaDeAgenda } from "./agendaPorDia";

const d = (fecha: string, aulas: number, sinEmpezar = 0, cumplen = 0): DiaDeAgenda => ({
  fecha,
  etiqueta: fecha || "Sin fecha agendada",
  aulas,
  tramos: [],
  cumplen,
  sinEmpezar,
});

const celda = (cal: NonNullable<ReturnType<typeof calendarioDeAgenda>>, fecha: string) => {
  for (const semana of cal.semanas) {
    for (const c of semana) if (c.fecha === fecha) return c;
  }
  return undefined;
};

describe("las semanas van de lunes a domingo y cubren el rango agendado", () => {
  // 2026-09-08 es martes y 2026-09-21 lunes: tres semanas de calendario.
  const cal = calendarioDeAgenda([d("2026-09-08", 3, 2), d("2026-09-21", 1)], "2026-09-15");

  it("rango min→max expandido a semanas completas", () => {
    expect(cal.semanas).toHaveLength(3);
    for (const semana of cal.semanas) expect(semana).toHaveLength(7);
    expect(cal.semanas[0][0].fecha).toBe("2026-09-07");
    expect(cal.semanas[2][6].fecha).toBe("2026-09-27");
  });

  it("cada celda agendada lleva su cuenta; la vacía en rango queda en cero", () => {
    expect(celda(cal, "2026-09-08")).toMatchObject({ diaDelMes: 8, aulas: 3, sinEmpezar: 2, enRango: true });
    expect(celda(cal, "2026-09-09")).toMatchObject({ aulas: 0, enRango: true });
  });

  it("el relleno de semana —antes del primer día y después del último— no está en rango", () => {
    expect(celda(cal, "2026-09-07")?.enRango).toBe(false);
    expect(celda(cal, "2026-09-27")?.enRango).toBe(false);
  });

  it("HOY se marca cuando cae dentro del lienzo, y sólo ahí", () => {
    expect(celda(cal, "2026-09-15")?.esHoy).toBe(true);
    const marcadas = cal.semanas.flat().filter((c) => c.esHoy);
    expect(marcadas).toHaveLength(1);
    // Con hoy fuera del operativo no se inventa ninguna marca.
    const sinHoy = calendarioDeAgenda([d("2026-09-08", 3)], "2026-12-25");
    expect(sinHoy.semanas.flat().some((c) => c.esHoy)).toBe(false);
  });

  it("el título nombra el periodo", () => {
    // «setiembre», no «septiembre»: los meses viven en un solo sitio desde el
    // 2026-09-10 (`mesesEnPalabras.ts`) y la app decía las dos cosas —la ficha
    // del curso-horario una y el calendario la otra— en la misma pantalla.
    expect(cal.titulo).toBe("setiembre 2026");
    expect(calendarioDeAgenda([d("2026-08-28", 1), d("2026-09-02", 1)], "2026-09-01").titulo)
      .toBe("agosto – setiembre 2026");
    expect(calendarioDeAgenda([d("2026-12-30", 1), d("2027-01-02", 1)], "2027-01-01").titulo)
      .toBe("diciembre 2026 – enero 2027");
  });
});

describe("lo que no cabe en un calendario se declara, no se esfuma", () => {
  it("una fecha imposible del libro va a su propio balde", () => {
    // `2026-09-31` no existe: el grid no puede colocarla y colocarla «corrida»
    // al 1 de octubre le inventaría un día. Se declara tal como está escrita.
    const cal = calendarioDeAgenda([d("2026-09-08", 1), d("2026-09-31", 4)], "2026-09-08");
    expect(cal.fechasIlegibles).toEqual([{ fecha: "2026-09-31", aulas: 4 }]);
    // Y el rango lo fijan solo las fechas reales: una semana, no cinco.
    expect(cal.semanas).toHaveLength(1);
  });

  it("un rango disparatado no fabrica mil semanas: se recorta declarando", () => {
    // Un año tecleado mal en el libro (2062) daría ~1.870 semanas de celdas
    // vacías. El lienzo se acota y lo que queda fuera se dice con su cuenta.
    const cal = calendarioDeAgenda([d("2026-09-08", 1), d("2062-01-01", 2)], "2026-09-08");
    expect(cal.semanas.length).toBeLessThanOrEqual(26);
    expect(cal.fueraDelLienzo).toEqual([{ fecha: "2062-01-01", aulas: 2 }]);
  });

  it("el grupo sin fecha no entra al lienzo: su repisa es de la superficie", () => {
    const cal = calendarioDeAgenda([d("", 7), d("2026-09-08", 1)], "2026-09-08");
    expect(cal.semanas.flat().some((c) => !c.fecha)).toBe(false);
    expect(cal.fechasIlegibles).toEqual([]);
  });

  it("sin ninguna fecha real no hay semanas y nada revienta", () => {
    const cal = calendarioDeAgenda([d("", 7)], "2026-09-08");
    expect(cal.semanas).toEqual([]);
    expect(cal.titulo).toBe("");
  });
});
