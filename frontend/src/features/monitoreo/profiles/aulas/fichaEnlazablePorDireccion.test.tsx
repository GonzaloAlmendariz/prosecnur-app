import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasFichaDeCursoHorario } from "./AulasFichaDeCursoHorario";

/**
 * **«Buscar por código» era la única superficie del perfil que no se podía
 * enlazar.**
 *
 * `?foco=aula:CH 21` abre el Registro de campo sobre esa aula desde el
 * 2026-09-08, y la ficha —que es la vista de unidad del curso-horario, la que
 * reúne agenda, parte, banda y Base de control— guardaba su código en un
 * `useState` suelto: no había forma de mandar a nadie a la ficha de un
 * curso-horario, ni de volver con el botón Atrás, ni de que la tabla de la
 * agenda llevara hasta ella. El mecanismo existía y esta superficie no lo
 * usaba.
 *
 * Se comprueba en RENDER ESTÁTICO a propósito: si el foco se resolviera en un
 * efecto en vez de en el initializer, aquí saldría vacío —y en pantalla
 * parpadearía un frame antes de aparecer—.
 */

const AGENDA = [
  {
    operational_code: "CH 43",
    faculty: "DERECHO",
    venue: "A206",
    scheduled_time: "16:00",
    scheduled_date: "2026-09-03",
    operational_status: "agendada",
    eligible_n: 40,
  },
  {
    operational_code: "CH 7",
    faculty: "LETRAS",
    venue: "P104",
    operational_status: "sin_contactar",
    eligible_n: 22,
  },
];

const pinta = (codigoEnFoco: string) =>
  renderToStaticMarkup(
    <AulasFichaDeCursoHorario
      agenda={AGENDA}
      partes={[]}
      bandas={[]}
      codigoEnFoco={codigoEnFoco}
    />,
  );

describe("la ficha se abre desde la direccion", () => {
  it("con foco llega abierta sobre ese curso-horario, sin tocar el buscador", () => {
    const html = pinta("CH 43");
    expect(html).toContain("CH 43");
    expect(html).toContain("A206");
    // Y no es que pinte el plan entero: la otra fila del fixture no sale.
    expect(html).not.toContain("P104");
  });

  it("el buscador llega escrito con el codigo, que es lo que lo encontro", () => {
    expect(pinta("CH 43")).toContain('value="CH 43"');
  });

  it("el codigo viaja por la URL y vuelve con otro formato: se compara normalizado", () => {
    // `claveDeBusqueda` ignora espacios, guiones y mayusculas. Un enlace
    // escrito a mano —o pasado por un navegador— no tiene por que traer el
    // codigo con el mismo formato que el `operational_code`.
    expect(pinta("ch-43")).toContain("A206");
  });

  it("sin foco no adivina: el buscador arranca vacio y ofrece los atajos", () => {
    const html = pinta("");
    expect(html).toContain('value=""');
    expect(html).not.toContain("A206");
  });
});
