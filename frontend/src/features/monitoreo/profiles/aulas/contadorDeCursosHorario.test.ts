import { describe, expect, it } from "vitest";
import { TOPE_DE_FILAS, contadorDeCursosHorario } from "./AulasMonitoreoPage";

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

  it("declara aparte las que son de la reserva adicional", () => {
    // Avance contaba 236 donde Fuentes contaba 196: la diferencia eran los
    // extras, y la misma palabra daba dos cifras sin explicar el salto.
    expect(contadorDeCursosHorario(236, 2616, 40))
      .toBe("se ven 236 de 2,616 cursos-horario · 40 de la reserva adicional");
    expect(contadorDeCursosHorario(196, 196, 0)).toBe("196 cursos-horario");
  });

  it("separa los miles en las dos cifras", () => {
    expect(contadorDeCursosHorario(1200, 2616, 0)).toContain("1,200 de 2,616");
  });
});

describe("«se ven N» es lo que se VE, no lo que trae el payload", () => {
  it("el tope de la tabla acota el numerador", () => {
    // **El defecto, medido en pantalla el 2026-09-08.** El pie de «Avance por
    // curso-horario» decía «se ven 500 de 1,392 cursos-horario» y el DOM tenía
    // 400 filas: le pasaban el largo de `course_status` —que el motor topea en
    // 500— en vez de lo que la tabla pinta, que topea en `TOPE_DE_FILAS`.
    //
    // El DENOMINADOR ya se había arreglado una vez —«el plan entero, no lo que
    // cupo en el payload»— y el numerador se quedó con el mismo defecto una capa
    // más arriba: la fracción volvía a contar dos conjuntos distintos, que es
    // justo lo que este contador existe para impedir.
    expect(TOPE_DE_FILAS).toBe(400);
    expect(contadorDeCursosHorario(Math.min(500, TOPE_DE_FILAS), 1392, 0))
      .toContain("se ven 400 de 1,392");
  });

  it("por debajo del tope no acota nada", () => {
    expect(contadorDeCursosHorario(Math.min(174, TOPE_DE_FILAS), 1392, 0))
      .toContain("se ven 174 de 1,392");
  });
});
