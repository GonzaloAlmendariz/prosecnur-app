import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasDisponibilidadDeAplicadores } from "./AulasDisponibilidadDeAplicadores";
import { mallaDeOferta, columnasVivas } from "./disponibilidadDeAplicadores";
import type { MonitoreoAulasDisponibilidad } from "../../../../api/monitoreo";

const bloque = (dias: unknown): MonitoreoAulasDisponibilidad =>
  ({ dias }) as unknown as MonitoreoAulasDisponibilidad;

const pinta = (disponibilidad: MonitoreoAulasDisponibilidad | null) => {
  const oferta = mallaDeOferta(disponibilidad);
  const vivas = oferta ? columnasVivas(oferta.franjas.length, [oferta.disponibles]) : [];
  return renderToStaticMarkup(
    <AulasDisponibilidadDeAplicadores oferta={oferta} vivas={vivas} />,
  );
};

/**
 * El tercer cuadro de Carga de campo (dictado 2026-09-02): la malla de OFERTA,
 * espejo de la de demanda. Sus tres estados —sin cargar, cargada vacía, con
 * gente— se declaran distinto, que es la clasificación C5 del contrato.
 */
describe("AulasDisponibilidadDeAplicadores", () => {
  it("sin la clave en sesión declara qué falta y de dónde sale", () => {
    const html = pinta(null);
    expect(html).toContain("disponibilidad de los aplicadores");
    expect(html).toContain("libro de disponibilidad");
    // El vacío declara su geometría como la rama con datos (guard del perfil).
    expect(html).toContain("data-qa-geometry-member");
  });

  it("cargada pero sin horas declaradas lo dice, sin confundirlo con «falta cargar»", () => {
    const html = pinta(bloque([]));
    expect(html).toContain("nadie declaró horas");
    expect(html).not.toContain("libro de disponibilidad");
  });

  it("pinta la oferta como espejo de la demanda: días de semana, franjas y quiénes", () => {
    const html = pinta(bloque([
      {
        dia: "lunes",
        franjas: [
          { inicio: "09:00", fin: "09:30", disponibles: 2, nombres: ["Ana Prueba", "Berta Ficticia"] },
          { inicio: "09:30", fin: "10:00", disponibles: 1, nombres: ["Ana Prueba"] },
        ],
      },
      { dia: "jueves", franjas: [{ inicio: "12:00", fin: "12:30", disponibles: 1, nombres: ["Ana Prueba"] }] },
    ]));
    // Mismo orden de días que el patrón semanal, con el marco completo: el
    // martes sin oferta sigue teniendo fila (C2).
    expect(html).toContain(">lunes<");
    expect(html).toContain(">martes<");
    expect(html).toContain(">jueves<");
    // La cifra es el dato de la franja, y su nombre accesible dice quiénes.
    // Sin exigir el cierre de la comilla: la franja pico añade su seña detrás.
    expect(html).toMatch(/aria-label="lunes 09:00: 2 disponibles — Ana Prueba, Berta Ficticia/);
    // Los KPIs de la oferta: cuánta gente y su mejor momento.
    expect(html).toContain("Aplicadores");
    expect(html).toContain("Pico de oferta");
    expect(html).toMatch(/lunes 09:00/);
  });

  it("declara lo que no cupo en la malla en vez de tragarlo", () => {
    const html = pinta(bloque([
      {
        dia: "lunes",
        franjas: [
          { inicio: "09:00", fin: "09:30", disponibles: 1, nombres: ["Ana Prueba"] },
          { inicio: "06:30", fin: "07:00", disponibles: 1, nombres: ["Ana Prueba"] },
        ],
      },
    ]));
    expect(html).toContain("1 franja declarada queda fuera del eje de 07:00 a 22:00");
  });
});
