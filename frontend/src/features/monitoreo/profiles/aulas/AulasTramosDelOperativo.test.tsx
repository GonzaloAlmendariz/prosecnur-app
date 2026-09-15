import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import AulasTramosDelOperativo from "./AulasTramosDelOperativo";
import { estadoDelTramo, sinCambios, tramosGuardables } from "./tramosDelOperativo";
import type { MonitoreoAulasTramo } from "../../../../api/monitoreo";

/**
 * Dictado de Gonzalo (2026-09-15): «más que semana en el estricto senso, con
 * rango a los que llamamos de forma personalizada». La pantalla teclea el rango
 * y el nombre; las cifras llegan derivadas y no se editan.
 */

const TRAMOS: MonitoreoAulasTramo[] = [
  { nombre: "Semana 1", desde: "2026-09-07", hasta: "2026-09-12", declarado: true,
    citas: 96, aplicadas: 92, por_aplicar: 4, vigente: false },
  { nombre: "Semana 2", desde: "2026-09-14", hasta: "2026-09-20", declarado: true,
    citas: 54, aplicadas: 4, por_aplicar: 50, vigente: true },
];

const pinta = (tramos: MonitoreoAulasTramo[]) =>
  renderToStaticMarkup(<AulasTramosDelOperativo tramos={tramos} onGuardar={() => {}} />);

describe("la tabla de tramos", () => {
  it("pinta cada tramo con su estado derivado y marca el que está en curso", () => {
    const html = pinta(TRAMOS);
    expect(html).toContain('value="Semana 1"');
    expect(html).toContain('value="2026-09-14"');
    expect(html).toContain(">96<");
    expect(html).toContain(">50<");
    // El que contiene hoy se señala: es el que manda en el reparto, y quien
    // mira necesita saber sobre cuál está trabajando la app.
    expect(html).toContain("en curso");
    expect(html).toContain("es-vigente");
  });

  it("sin tramos declarados enseña los derivados y lo dice", () => {
    // C3: el vacío está contenido. El operativo se ve desde el primer día y
    // declarar tramos es un añadido, no un requisito.
    const html = pinta([{ nombre: "Semana 1", desde: "2026-09-07", hasta: "2026-09-13",
                          declarado: false, citas: 96, aplicadas: 92, por_aplicar: 4 }]);
    expect(html).toContain("Todavía no has nombrado ninguno");
    expect(html).toContain('value="Semana 1"');
  });

  it("sin ningún tramo el vacío se explica en vez de dejar la tabla muda", () => {
    const html = pinta([]);
    expect(html).toContain("Añade uno para decirle a la app");
    // Y el marco sigue en pie (C2): la cabecera de la tabla no depende de que
    // haya filas.
    expect(html).toContain("Por aplicar");
  });
});

describe("qué se guarda", () => {
  it("un tramo sin las DOS fechas no se guarda", () => {
    // Un rango a medias no puede contener a nadie; lo que no se hace es
    // descartarlo en silencio, y por eso el que llama sabe cuántos cayeron.
    const borrador = [
      { nombre: "Semana 1", desde: "2026-09-07", hasta: "2026-09-12" },
      { nombre: "a medias", desde: "2026-09-21", hasta: "" },
      { nombre: "vacío", desde: "", hasta: "" },
    ];
    expect(tramosGuardables(borrador)).toEqual([
      { nombre: "Semana 1", desde: "2026-09-07", hasta: "2026-09-12" },
    ]);
  });

  it("una fecha que no es ISO tampoco pasa", () => {
    expect(tramosGuardables([{ nombre: "x", desde: "07/09/2026", hasta: "2026-09-12" }]))
      .toEqual([]);
  });

  it("nada que guardar cuando el borrador es lo ya declarado", () => {
    const borrador = TRAMOS.map((t) => ({ nombre: t.nombre, desde: t.desde, hasta: t.hasta }));
    expect(sinCambios(borrador, TRAMOS)).toBe(true);
    expect(sinCambios(borrador.slice(1), TRAMOS)).toBe(false);
    expect(sinCambios(
      [{ ...borrador[0], nombre: "Otra cosa" }, borrador[1]], TRAMOS)).toBe(false);
  });
});

describe("a qué fila pertenece cada cifra", () => {
  it("el estado se empareja por RANGO, no por posición", () => {
    // Insertar un tramo en medio dejaría las cifras pegadas a la fila de al
    // lado sin que nada fallara: los números siguen ahí, sólo que en la fila
    // equivocada. Es la clase de error que no se ve mirando la pantalla.
    expect(estadoDelTramo(TRAMOS, { desde: "2026-09-14", hasta: "2026-09-20" })?.citas)
      .toBe(54);
    expect(estadoDelTramo(TRAMOS, { desde: "2026-09-07", hasta: "2026-09-12" })?.citas)
      .toBe(96);
  });

  it("un rango que el backend todavía no conoce no toma prestado el de otro", () => {
    expect(estadoDelTramo(TRAMOS, { desde: "2026-09-21", hasta: "2026-09-27" }))
      .toBeUndefined();
  });
});
