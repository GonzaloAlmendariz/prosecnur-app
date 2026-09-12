import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { CodigoEnCelda, COLUMNAS_DE_CODIGO } from "./CodigoEnCelda";

/**
 * **La fila de la agenda no puede contar todo lo que sabemos del curso-horario.**
 *
 * Son 70 columnas de las que caben 14, con 365 px escondidos a la derecha
 * —medido el 2026-09-12 en `modelo>agenda`—. El sitio donde sí cabe todo es la
 * ficha, y el código es lo que lleva hasta ella.
 */

const href = (codigo: string) =>
  `/monitoreo?seccion=consultas&pestana=ficha&foco=${encodeURIComponent(`aula:${codigo}`)}`;

describe("el codigo de una celda lleva a su ficha", () => {
  it("es un enlace con el foco puesto", () => {
    const html = renderToStaticMarkup(<CodigoEnCelda valor="CH 43" hrefDeFicha={href} />);
    expect(html).toContain("seccion=consultas");
    expect(html).toContain("pestana=ficha");
    expect(html).toContain("foco=aula%3ACH%2043");
    expect(html).toContain("CH 43");
  });

  it("una celda vacia no inventa un enlace a ninguna parte", () => {
    // Hay filas sin titular —los titulares mismos— y la columna existe igual.
    expect(renderToStaticMarkup(<CodigoEnCelda valor="" hrefDeFicha={href} />)).not.toContain("<a ");
    expect(renderToStaticMarkup(<CodigoEnCelda valor="   " hrefDeFicha={href} />)).not.toContain("<a ");
  });

  it("sin la prop se pinta texto plano: la tabla sigue viva sin Router", () => {
    const html = renderToStaticMarkup(<CodigoEnCelda valor="CH 43" />);
    expect(html).toContain("CH 43");
    expect(html).not.toContain("<a ");
  });

  it("el titular de una reserva tambien enlaza: desde la cadena se va al titular", () => {
    expect(COLUMNAS_DE_CODIGO.has("operational_code")).toBe(true);
    expect(COLUMNAS_DE_CODIGO.has("titular_operational_code")).toBe(true);
    // Y NO cualquier columna con pinta de identificador: `classroom_id` es el
    // aula fisica del sorteo, no un curso-horario, y su ficha no existe.
    expect(COLUMNAS_DE_CODIGO.has("classroom_id")).toBe(false);
  });
});
