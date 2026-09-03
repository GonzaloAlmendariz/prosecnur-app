import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasAsignacionDeAplicadores } from "./AulasAsignacionDeAplicadores";
import { repartoDeAplicadores } from "./repartoDeAplicadores";
import type { MonitoreoAulasReparto } from "../../../../api/monitoreo";

const pinta = (crudo: unknown, lugares?: ReadonlyMap<string, string>) =>
  renderToStaticMarkup(
    <AulasAsignacionDeAplicadores
      reparto={repartoDeAplicadores(crudo as MonitoreoAulasReparto | null)}
      lugares={lugares}
    />,
  );

const REPARTO = {
  dias: [
    {
      fecha: "2026-09-11",
      asignaciones: [
        { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20" },
        { codigo: "CH 3", aplicador: "Berta Ficticia", inicio: "15:00", fin: "15:20" },
      ],
      no_cubiertos: ["CH 2"],
      por_confirmar: ["CH 7"],
    },
  ],
  equidad: [
    { aplicador: "Ana Prueba", asignadas: 1 },
    { aplicador: "Berta Ficticia", asignadas: 1 },
    { aplicador: "Mario Sintetico", asignadas: 0 },
  ],
};

/**
 * El cuarto cuadro de Carga de campo (dictado 2026-09-02: «una pestaña de
 * asignación… equitativa… pero que sea repetible por si llegan nuevas
 * confirmaciones»): el reparto vigente por día, con lo descubierto DESTACADO
 * y las cargas por aplicador con los ceros a la vista.
 */
describe("AulasAsignacionDeAplicadores", () => {
  it("sin la clave en sesión declara que el reparto necesita la disponibilidad", () => {
    const html = pinta(null);
    expect(html).toContain("disponibilidad de los aplicadores");
    expect(html).toContain("data-qa-geometry-member");
  });

  it("lista cada día con sus citas: quién va, a qué cita y en qué ventana", () => {
    const html = pinta(REPARTO);
    expect(html).toContain("Viernes 11/09");
    expect(html).toContain("CH 1");
    expect(html).toContain("10:00–10:20");
    expect(html).toContain("Ana Prueba");
  });

  it("el lugar de la cita va en su chip, con el color de su letra", () => {
    // Dictado 2026-09-02 (sistema de chips): la tabla de Asignación lleva la
    // columna del lugar; el color sale de `tonoDePabellon` — determinista, el
    // mismo A206 del detalle de la malla. Sin mapa, la columna calla.
    const conLugares = pinta(REPARTO, new Map([["CH 1", "A206"]]));
    expect(conLugares).toContain(">Lugar<");
    expect(conLugares).toMatch(/aulas-chip-lugar es-tono-\d">A206</);
    expect(pinta(REPARTO)).not.toContain("A206");
  });

  it("lo descubierto va destacado: es el problema operativo, no un pie de página", () => {
    const html = pinta(REPARTO);
    expect(html).toContain("aulas-asigna-descubiertos");
    expect(html).toContain("sin nadie que llegue");
    expect(html).toContain("CH 2");
    // Y el KPI lo cuenta arriba, no solo dentro del día.
    expect(html).toContain("Sin nadie que llegue");
  });

  it("la equidad enseña también a los de cero: estar libre es un dato", () => {
    const html = pinta(REPARTO);
    expect(html).toContain("Mario Sintetico");
    expect(html).toMatch(/Mario Sintetico[^]*?>0</);
  });

  it("promete su vigencia en una línea: se recalcula con cada Recargar", () => {
    expect(pinta(REPARTO)).toContain("se recalcula con cada Recargar");
  });

  it("declara lo por confirmar sin inventarle gente", () => {
    const html = pinta(REPARTO);
    expect(html).toContain("Por confirmar");
    expect(html).toContain("CH 7");
    expect(html).toContain("no piden gente todavía");
  });

  it("las listas van COMPLETAS: el techo con «y N más» quedó revocado", () => {
    // Dictado 2026-09-02, mirando un detalle recortado: «no pones las cosas
    // completas y actúas como si no tuvieras espacio cuando la pestaña puede
    // darle más espacio sin problema». Doce descubiertos son doce códigos en
    // pantalla; la línea envuelve y crece, no esconde.
    const html = pinta({
      dias: [{
        fecha: "2026-09-11",
        asignaciones: [],
        no_cubiertos: Array.from({ length: 12 }, (_, i) => `CH ${i + 1}`),
        por_confirmar: [],
      }],
      equidad: [{ aplicador: "Ana Prueba", asignadas: 0 }],
    });
    expect(html).toContain("CH 12");
    expect(html).not.toContain("más");
  });

  it("cargada y sin citas pactadas: nada que repartir, con el equipo a la vista", () => {
    const html = pinta({
      dias: [],
      equidad: [{ aplicador: "Ana Prueba", asignadas: 0 }],
    });
    expect(html).toContain("Nada que repartir todavía");
    // El equipo libre sigue visible: el rail no desaparece con el vacío (C2).
    expect(html).toContain("Ana Prueba");
    expect(html).not.toContain("libro de disponibilidad");
  });
});
