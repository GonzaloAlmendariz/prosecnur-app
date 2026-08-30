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

describe("reparte lo que publica el motor, no las filas que viajan", () => {
  /**
   * **La premisa del subtítulo.**
   *
   * El panel se rotula con `contadorDeLoQueReparte`, que dice «1,424
   * cursos-horario» cuando el motor manda su reparto y «se ven 500 de 1,424»
   * cuando no. Ese rótulo sólo es honesto mientras el gráfico se comporte así,
   * y durante un tiempo no lo fue al revés: llevaba el aviso de recorte con el
   * reparto completo puesto, y medido en pantalla sus seis tramos sumaban 1.424
   * mientras el subtítulo prometía 500. Quien lo leía creía que le faltaba el
   * 65 % de lo que estaba viendo.
   *
   * El aviso era correcto cuando el gráfico repartía `filas`, y se quedó escrito
   * cuando pasó a preferir el resumen del motor: una salvedad que caducó.
   */
  const pocasFilas = [
    { operational_code: "CH 1", application_state: "cerrando" },
    { operational_code: "CH 2", application_state: "cerrando" },
  ] as never;

  it("con resumen del motor cuenta sobre el total del motor, no sobre las filas", () => {
    const out = renderToStaticMarkup(
      <AulasEstadoChart filas={pocasFilas} resumen={resumen as never} desconocidasMotor={0} />,
    );
    // 3 + 2 + 16 + 152 + 26 + 70 = 269, menos las 70 del banco que no salen a
    // campo = 199 en juego. Lo que importa es que NO son las 2 que viajan.
    expect(out).toContain("199");
  });

  it("sin resumen del motor sí se reparte lo que viaja", () => {
    // El control que distingue: si el gráfico ignorara `filas` siempre, la
    // aserción de arriba pasaría sin probar de dónde salen las cifras.
    const out = renderToStaticMarkup(
      <AulasEstadoChart filas={pocasFilas} resumen={null} desconocidasMotor={0} />,
    );
    expect(out).not.toContain("199");
    expect(out).toContain("2 cursos-horario");
  });
});

describe("las tres ramas del pie explican el mecanismo con las mismas palabras", () => {
  /**
   * `dondeEstanLasOtras` tiene tres ramas y **la del medio se desviaba**: las
   * otras dos dicen «sólo entran si cae su titular», que se entiende sin saber
   * nada del diseño muestral, y ésta decía «sin asignar a ninguna cadena».
   *
   * «Cadena» sólo se define en la sección Consultas, en el panel «Cadena de
   * reemplazos», y quien lee este pie está en Resumen. Un término del modelo de
   * datos usado a tres secciones de donde se define.
   */
  const conBanco = (banco: number, enReserva: number) =>
    renderToStaticMarkup(
      <AulasEstadoChart
        filas={[]}
        resumen={[
          { clave: "lista", aulas: 2 }, { clave: "cerrando", aulas: 20 },
          ...(enReserva ? [{ clave: "en_reserva", aulas: enReserva }] : []),
        ] as never}
        desconocidasMotor={0}
        bancoMotor={banco}
      />);

  it("cuando TODO lo que queda fuera es banco, tampoco se nombra la cadena", () => {
    // Banco SIN reservas encadenadas dormidas: `fuera === banco` y no hay
    // dormidas que nombrar. Es la rama que se desviaba, y se da en un estudio
    // que tiene banco pero ninguna cadena montada.
    const out = conBanco(5, 0);
    expect(out).toContain("sin un titular al que respalden");
    expect(out).not.toContain("cadena");
  });

  it("y con dormidas Y banco sigue diciendo el mecanismo, como siempre", () => {
    const out = conBanco(30, 70);
    expect(out).toMatch(/sólo entran si cae su titular/);
    expect(out).not.toContain("cadena");
  });
});
