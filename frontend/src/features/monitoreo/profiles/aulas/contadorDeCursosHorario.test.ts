import { describe, expect, it } from "vitest";
import { contadorDeCursosHorario } from "./AulasMonitoreoPage";

/**
 * Medido en Avance el 2026-08-23, sobre el plan de 2.616 del sorteo del 22: dos
 * paneles —«Status de aplicación» y «Cursos-horario por cobertura»— decían «500
 * de 2,616 cursos-horario».
 *
 * Ese par de números admite dos lecturas OPUESTAS: que 500 aulas ya hicieron
 * algo, o que la pantalla sólo está enseñando 500 de las que hay. Aquí es lo
 * segundo —el motor manda las primeras 500 filas— y sin decirlo se lee como lo
 * primero, que es la lectura optimista.
 */
describe("contadorDeCursosHorario", () => {
  it("dice que es un recorte cuando lo hay", () => {
    expect(contadorDeCursosHorario(500, 2616, 0)).toBe("se ven 500 de 2,616 cursos-horario");
  });

  it("NO anuncia un recorte cuando están todas", () => {
    // Anunciar uno que no existe hace dudar de una cifra completa.
    expect(contadorDeCursosHorario(193, 193, 0)).toBe("193 cursos-horario");
    expect(contadorDeCursosHorario(193, 0, 0)).toBe("193 cursos-horario");
  });

  it("declara aparte las que son del banco", () => {
    // Avance contaba 236 donde Fuentes contaba 196: la diferencia eran los
    // extras, y la misma palabra daba dos cifras sin explicar el salto.
    expect(contadorDeCursosHorario(236, 2616, 40))
      .toBe("se ven 236 de 2,616 cursos-horario · 40 del banco");
    expect(contadorDeCursosHorario(196, 196, 0)).toBe("196 cursos-horario");
  });

  it("separa los miles en las dos cifras", () => {
    expect(contadorDeCursosHorario(1200, 2616, 0)).toContain("1,200 de 2,616");
  });
});
