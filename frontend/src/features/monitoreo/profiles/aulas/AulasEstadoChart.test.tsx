import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasEstadoChart } from "./AulasEstadoChart";

/**
 * El pie de «Status de aplicación» contaba dos conjuntos distintos.
 *
 * Decía «5 de 269 cursos-horario todavía no salen a campo», y de esos 269, 70
 * eran reservas del banco que NO van a salir salvo que caiga su titular. El
 * numerador ya las excluía —sólo suma `pendiente` y `lista`— y el denominador
 * las metía: media fracción contaba una cosa y la otra media, otra. Leído de
 * corrido, decía que 264 cursos-horario ya salieron cuando fueron 194.
 */

const resumen = [
  { clave: "pendiente", aulas: 3 },
  { clave: "lista", aulas: 2 },
  { clave: "en_aplicacion", aulas: 16 },
  { clave: "cerrando", aulas: 152 },
  { clave: "reemplazada", aulas: 26 },
  { clave: "en_reserva", aulas: 70 },
];

const html = (r: typeof resumen) =>
  renderToStaticMarkup(<AulasEstadoChart filas={[]} resumen={r as never} desconocidasMotor={0} />);

describe("el pie de «Status de aplicación» usa el denominador de su numerador", () => {
  it("descuenta las reservas dormidas, que no salen a campo", () => {
    const out = html(resumen);
    // 269 - 70 = 199, no 269.
    expect(out).toContain("5 de 199");
    expect(out).not.toContain("5 de 269");
  });

  it("y dice dónde fueron a parar las que descontó", () => {
    // Si la cabecera dice 269 y el pie 199, la diferencia tiene que estar
    // nombrada o el lector la lee como aulas perdidas.
    expect(html(resumen)).toContain("70");
    // La frase decía «reservas que esperan en el banco» y ahora dice «esperan
    // en reserva»: lo que se comprueba es que la diferencia esté NOMBRADA, no
    // con qué palabras. El cambio de vocabulario tiene su propio test abajo.
    expect(html(resumen)).toMatch(/esperan en reserva/);
  });

  it("sin banco, el denominador vuelve a ser el total y no sobra la frase", () => {
    const sinBanco = resumen.filter((e) => e.clave !== "en_reserva");
    const out = html(sinBanco);
    expect(out).toContain("5 de 199");
    expect(out).not.toMatch(/esperan en reserva/);
  });
});

describe("«banco» no nombra dos conjuntos distintos", () => {
  it("las dormidas de una cadena no se llaman «del banco»", () => {
    // Medido el 2026-08-23 sobre el sorteo del 22: la misma pantalla decía
    // «las otras 507 son reservas que esperan en el banco» y, cuatro renglones
    // más abajo, «1.916 son reservas del banco». La misma palabra para dos
    // conjuntos que no se solapan: las 507 están ENCADENADAS a un titular
    // concreto y el banco es capacidad sin asignar a nadie.
    //
    // Se mira el RENDER y no el fuente: la primera versión de este test buscaba
    // la frase vieja en el archivo y la encontraba en el comentario que la cita
    // como evidencia. Un test que lee el código en vez de la pantalla se cree
    // cualquier cosa que esté escrita en el código.
    const out = html(resumen);
    expect(out).toContain("esperan en reserva");
    expect(out).not.toContain("en el banco");
  });
});
