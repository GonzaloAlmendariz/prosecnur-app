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

describe("el banco tampoco está «en juego», aunque el motor no lo marque dormido", () => {
  const conBanco = (r: typeof resumen, banco: number) =>
    renderToStaticMarkup(
      <AulasEstadoChart filas={[]} resumen={r as never} desconocidasMotor={0} bancoMotor={banco} />,
    );

  it("lo descuenta del denominador", () => {
    // Medido el 2026-08-23 sobre el sorteo del 22: el motor clasificó las 507
    // reservas encadenadas como `en_reserva` y las 1.916 del banco como «Sin
    // agendar». Descontar sólo por estado dejaba «2.109 de 2.109 cursos-horario
    // en juego» sobre un operativo de 193 visitas: diez veces el trabajo real.
    //
    // Aquí: denominador 269 − 70 dormidas − 2 de banco = 197, y el numerador
    // baja igual —5 − 2 = 3— porque el banco cae en `pendiente` y estaba en
    // los DOS lados de la fracción.
    const out = conBanco(resumen, 2);
    expect(out).toContain("3 de 197");
    expect(out).not.toContain("5 de 199");
  });

  it("el numerador descuenta el banco igual que el denominador", () => {
    // Arreglar sólo el denominador dejó en pantalla «2.109 de 193»: la misma
    // mitad-y-mitad de antes con los papeles cambiados.
    const out = conBanco(resumen, 2);
    expect(out).not.toMatch(/5 de 19[0-9]/);
  });

  it("sin banco declarado se comporta como antes", () => {
    // Un payload anterior no manda `course_status_banco`; ahí el descuento por
    // estado es lo único que hay y sigue siendo mejor que nada.
    expect(conBanco(resumen, 0)).toContain("5 de 199");
  });

  it("no baja de cero aunque el banco supere lo que queda", () => {
    // Un desglose incoherente no puede producir cifras negativas: la frase
    // diría «−95 de −20», que no significa nada.
    const out = conBanco(resumen, 5000);
    expect(out).not.toMatch(/-\d/);
  });

  it("separa las dormidas del banco en vez de meterlas en un saco", () => {
    // «Las otras 2.423 sólo entran si cae su titular» es falso para 1.916 de
    // ellas: el banco no está asignado a ninguna cadena.
    const out = conBanco(resumen, 2);
    expect(out).toContain("esperan en reserva");
    expect(out).toContain("en el banco");
  });
});
