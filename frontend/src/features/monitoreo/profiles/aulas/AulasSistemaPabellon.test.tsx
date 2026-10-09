import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChipDato, ChipHora, ChipLugar, identidadEnCelda } from "./AulasSistemaPabellon";

/**
 * Los chips del Sistema Pabellón, como se pintan: el lugar con el tono de SU
 * letra, la hora sobria, y la celda de tabla que sólo chipifica columnas de
 * identidad — el resto devuelve null y la tabla pinta texto, que es el
 * criterio de sobriedad del sistema.
 */
describe("los tres chips del sistema", () => {
  it("el lugar lleva el tono de su letra, y el mismo lugar siempre el mismo", () => {
    const a = renderToStaticMarkup(<ChipLugar lugar="A206" />);
    expect(a).toContain("aulas-chip-lugar");
    expect(a).toMatch(/es-tono-\d/);
    // Determinismo de punta a punta: dos renders y otro salón del mismo
    // pabellón comparten clase de tono.
    expect(renderToStaticMarkup(<ChipLugar lugar="A206" />)).toBe(a);
    const tonoDe = (html: string) => /es-tono-(\d)/.exec(html)?.[1];
    expect(tonoDe(renderToStaticMarkup(<ChipLugar lugar="A703" />))).toBe(tonoDe(a));
  });

  it("un lugar sin letra queda neutro, sin clase de tono", () => {
    const html = renderToStaticMarkup(<ChipLugar lugar="101" />);
    expect(html).toContain("aulas-chip-lugar");
    expect(html).not.toMatch(/es-tono-/);
  });

  it("la hora y el dato usan sus clases sobrias", () => {
    expect(renderToStaticMarkup(<ChipHora>16:00</ChipHora>)).toContain("aulas-chip-hora");
    const dato = renderToStaticMarkup(<ChipDato>lun 10/08</ChipDato>);
    expect(dato).toContain("aulas-chip");
    expect(dato).not.toContain("aulas-chip-hora");
    expect(dato).not.toContain("aulas-chip-lugar");
  });
});

describe("identidadEnCelda: chips sólo en columnas de identidad", () => {
  const html = (col: string, valor: string) => {
    const nodo = identidadEnCelda(col, valor);
    return nodo === null ? null : renderToStaticMarkup(<>{nodo}</>);
  };

  it("un lugar se pinta como chip de pabellón", () => {
    for (const col of ["venue", "actual_room", "room", "scheduled_venue"]) {
      expect(html(col, "V110"), col).toContain("aulas-chip-lugar");
    }
  });

  it("una hora se pinta como chip de hora", () => {
    expect(html("scheduled_time", "16:00")).toContain("aulas-chip-hora");
    expect(html("sesiones_dia_hora", "MAR 14:00-16:00")).toContain("aulas-chip-hora");
  });

  it("«Sesiones y aula» descriptivo se parte en sesión + pabellón, con el texto entero en el title", () => {
    const celda = html("label", "LUN 16:00 A206");
    expect(celda).toContain("aulas-chip-hora");
    expect(celda).toContain("aulas-chip-lugar");
    expect(celda).toContain('title="LUN 16:00 A206"');
  });

  it("un label que es código académico NO se chipifica: un código no es un lugar", () => {
    expect(identidadEnCelda("label", "urb209_0601")).toBeNull();
  });

  it("lo vacío y lo demás quedan en texto: null", () => {
    expect(identidadEnCelda("venue", "")).toBeNull();
    expect(identidadEnCelda("venue", "—")).toBeNull();
    expect(identidadEnCelda("operational_code", "CH 1")).toBeNull();
    expect(identidadEnCelda("scheduled_date", "2026-09-01")).toBeNull();
  });
});
