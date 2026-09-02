import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasEstadoChart } from "./AulasEstadoChart";

/**
 * El pie de «Status de aplicación» contaba dos conjuntos distintos.
 *
 * Decía «5 de 269 cursos-horario todavía no salen a campo», y de esos 269, 70
 * eran de la reserva adicional que NO van a salir salvo que caiga su titular.
 * El numerador ya las excluía —sólo suma `pendiente` y `lista`— y el
 * denominador las metía: media fracción contaba una cosa y la otra media,
 * otra. Leído de corrido, decía que 264 cursos-horario ya salieron cuando
 * fueron 194.
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

  it("sin reserva adicional, el denominador vuelve a ser el total y no sobra la frase", () => {
    const sinReserva = resumen.filter((e) => e.clave !== "en_reserva");
    const out = html(sinReserva);
    expect(out).toContain("5 de 199");
    expect(out).not.toMatch(/esperan en reserva/);
  });
});

describe("«reserva adicional» no nombra dos conjuntos distintos", () => {
  it("las dormidas de una cadena no se llaman «de la reserva adicional»", () => {
    // Medido el 2026-08-23 sobre el sorteo del 22: la misma pantalla decía
    // «las otras 507 son reservas que esperan en el banco» y, cuatro renglones
    // más abajo, «1.916 son reservas del banco». La misma palabra para dos
    // conjuntos que no se solapan: las 507 están ENCADENADAS a un titular
    // concreto y la reserva adicional es capacidad sin asignar a nadie.
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

describe("la reserva adicional tampoco está «en juego», aunque el motor no la marque dormida", () => {
  const conReserva = (r: typeof resumen, reserva: number) =>
    renderToStaticMarkup(
      <AulasEstadoChart filas={[]} resumen={r as never} desconocidasMotor={0} reservaMotor={reserva} />,
    );

  it("lo descuenta del denominador", () => {
    // Medido el 2026-08-23 sobre el sorteo del 22: el motor clasificó las 507
    // reservas encadenadas como `en_reserva` y las 1.916 de la reserva
    // adicional como «Sin agendar». Descontar sólo por estado dejaba «2.109 de
    // 2.109 cursos-horario en juego» sobre un operativo de 193 visitas: diez
    // veces el trabajo real.
    //
    // Aquí: denominador 269 − 70 dormidas − 2 de reserva adicional = 197, y el
    // numerador baja igual —5 − 2 = 3— porque la reserva adicional cae en
    // `pendiente` y estaba en los DOS lados de la fracción.
    const out = conReserva(resumen, 2);
    expect(out).toContain("3 de 197");
    expect(out).not.toContain("5 de 199");
  });

  it("el numerador descuenta la reserva adicional igual que el denominador", () => {
    // Arreglar sólo el denominador dejó en pantalla «2.109 de 193»: la misma
    // mitad-y-mitad de antes con los papeles cambiados.
    const out = conReserva(resumen, 2);
    expect(out).not.toMatch(/5 de 19[0-9]/);
  });

  it("sin reserva adicional declarada se comporta como antes", () => {
    // Un payload anterior no manda `course_status_banco`; ahí el descuento por
    // estado es lo único que hay y sigue siendo mejor que nada.
    expect(conReserva(resumen, 0)).toContain("5 de 199");
  });

  it("no baja de cero aunque la reserva adicional supere lo que queda", () => {
    // Un desglose incoherente no puede producir cifras negativas: la frase
    // diría «−95 de −20», que no significa nada.
    const out = conReserva(resumen, 5000);
    expect(out).not.toMatch(/-\d/);
  });

  it("separa las dormidas de la reserva adicional en vez de meterlas en un saco", () => {
    // «Las otras 2.423 sólo entran si cae su titular» es falso para 1.916 de
    // ellas: la reserva adicional no está asignada a ninguna cadena.
    const out = conReserva(resumen, 2);
    expect(out).toContain("esperan en reserva");
    expect(out).toContain("en la reserva adicional");
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
    // 3 + 2 + 16 + 152 + 26 + 70 = 269, menos las 70 de la reserva adicional
    // que no salen a campo = 199 en juego. Lo que importa es que NO son las 2
    // que viajan.
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
  const conReserva = (reserva: number, enReserva: number) =>
    renderToStaticMarkup(
      <AulasEstadoChart
        filas={[]}
        resumen={[
          { clave: "lista", aulas: 2 }, { clave: "cerrando", aulas: 20 },
          ...(enReserva ? [{ clave: "en_reserva", aulas: enReserva }] : []),
        ] as never}
        desconocidasMotor={0}
        reservaMotor={reserva}
      />);

  it("cuando TODO lo que queda fuera es reserva adicional, tampoco se nombra la cadena", () => {
    // Reserva adicional SIN reservas encadenadas dormidas: `fuera === reserva`
    // y no hay dormidas que nombrar. Es la rama que se desviaba, y se da en un
    // estudio que tiene reserva adicional pero ninguna cadena montada.
    const out = conReserva(5, 0);
    expect(out).toContain("sin un titular al que respalden");
    expect(out).not.toContain("cadena");
  });

  it("y con dormidas Y reserva adicional sigue diciendo el mecanismo, como siempre", () => {
    const out = conReserva(30, 70);
    expect(out).toMatch(/sólo entran si cae su titular/);
    expect(out).not.toContain("cadena");
  });
});

/**
 * **La reserva adicional se descontaba dos veces cuando cae en `en_reserva`.**
 *
 * `enJuegoDe` derivaba las vivas de los tramos —«todo lo que no es
 * `en_reserva`»— y luego restaba la reserva adicional. Eso sólo es correcto si
 * la reserva adicional NO está en ese tramo, que es el caso que motivó el
 * descuento (2026-08-23: el motor clasificaba las 1.916 de la reserva
 * adicional como «Sin agendar»).
 *
 * Medido el 2026-08-30 sobre el estudio de 1.424: las 77 de la reserva
 * adicional están las 77 en `en_reserva`, así que las vivas (192) ya las
 * excluían y el pie publicaba **115 en juego** cuando el motor marca
 * `en_juego` en **174** —156 titulares vivos + 18 reservas activadas—. 59
 * cursos-horario menos de los que hay en campo, en el titular de Resumen.
 *
 * Se cuenta desde el total con las dormidas del motor, que las cuenta SIN la
 * reserva adicional, así que `total − dormidas − reserva` da `sum(en_juego)`
 * en los dos escenarios.
 */
const REAL = [
  { clave: "pendiente", aulas: 0 },
  { clave: "lista", aulas: 22 },
  { clave: "en_aplicacion", aulas: 0 },
  { clave: "cerrando", aulas: 152 },
  { clave: "reemplazada", aulas: 18 },
  { clave: "en_reserva", aulas: 1232 },
];

const conMotor = (r: typeof REAL, reserva: number, dormidas: number) =>
  renderToStaticMarkup(
    <AulasEstadoChart filas={[]} resumen={r as never} desconocidasMotor={0}
      reservaMotor={reserva} dormidasMotor={dormidas} />,
  );

describe("la reserva adicional no se descuenta dos veces", () => {
  it("con la reserva adicional DENTRO de `en_reserva`, en juego son 174 y no 115", () => {
    // 1.424 − 1.173 dormidas − 77 de reserva adicional = 174.
    const out = conMotor(REAL, 77, 1173);
    expect(out).toContain("174");
    expect(out).not.toContain("115");
  });

  it("y el pie reparte las otras sin contar la reserva adicional dos veces", () => {
    // fuera = 1.424 − 174 = 1.250 = 1.173 en reserva + 77 en la reserva
    // adicional. Antes decía «1.232 y 77», que suman 1.309: la misma reserva
    // adicional en los dos sumandos.
    const out = conMotor(REAL, 77, 1173);
    expect(out).toContain("1,173");
    expect(out).toContain("77");
    expect(out).not.toContain("1,232 esperan");
  });

  it("con la reserva adicional FUERA de `en_reserva` sigue acertando", () => {
    // El caso de 2026-08-23, que es el que motivó el descuento: el motor metía
    // la reserva adicional en «Sin agendar». 200 totales, 70 de reserva
    // adicional en `pendiente`, 30 dormidas de verdad → en juego 100.
    const comoEn2025 = [
      { clave: "pendiente", aulas: 70 },
      { clave: "lista", aulas: 10 },
      { clave: "en_aplicacion", aulas: 0 },
      { clave: "cerrando", aulas: 90 },
      { clave: "reemplazada", aulas: 0 },
      { clave: "en_reserva", aulas: 30 },
    ];
    expect(conMotor(comoEn2025, 70, 30)).toContain("100");
  });

  it("sin el dato del motor cae a la forma anterior, no a cero", () => {
    // `dormidasMotor` es opcional: un backend viejo no lo emite y la vista no
    // puede quedarse en blanco por eso.
    const out = renderToStaticMarkup(
      <AulasEstadoChart filas={[]} resumen={REAL as never} desconocidasMotor={0} reservaMotor={77} />,
    );
    expect(out).toContain("115");
  });
});
