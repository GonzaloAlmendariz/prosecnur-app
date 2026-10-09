/**
 * **El aviso no cuenta viajes solitarios: dice por qué existe cada uno.**
 *
 * Dictado 2026-09-04: «los avisos [tienen que] significar o permitirnos hacer
 * algo… ¿Quiénes tienen disponibilidad a esa hora? No me estás dando soluciones
 * ni formas de poder yo resolver las cosas».
 *
 * Lo que se sujeta aquí es lo que distingue este bloque de un contador: que
 * NOMBRA a la gente, y que separa la única causa que el usuario puede cerrar
 * desde la tabla —el tope del día— de las tres que piden mover la agenda.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AulasViajesSolitarios, { motivoDelViaje } from "./AulasViajesSolitarios";
import type { SalidaDeViajeSolitario } from "./salidasDelReparto";

const viaje = (extra: Partial<SalidaDeViajeSolitario>): SalidaDeViajeSolitario => ({
  aplicador: "MANAYAY VÁSQUEZ, MARICIELO",
  fecha: "2026-09-08",
  etiqueta: "martes 08/09",
  codigo: "CH 113",
  desdeRecojo: "18:15",
  hasta: "19:15",
  causa: "sin-oferta",
  frenadosPorTope: [],
  ocupados: [],
  ...extra,
});

describe("motivoDelViaje", () => {
  it("con el tope, nombra a quién le falta margen y cuánto lleva", () => {
    const t = motivoDelViaje(viaje({
      causa: "tope",
      frenadosPorTope: [{ aplicador: "MANAYAY VÁSQUEZ, MARICIELO", lleva: 4 }],
    }));
    // El nombre va normalizado, como en toda la vista.
    expect(t).toContain("Manayay Vásquez, Maricielo");
    expect(t).toContain("lleva 4");
  });

  it("con los demás ocupados, nombra la cita que los tiene", () => {
    const t = motivoDelViaje(viaje({
      causa: "ocupados",
      ocupados: [{ aplicador: "PUCHURI CHAMORRO, SARA DANIELA", porCodigo: "CH 71" }],
    }));
    expect(t).toContain("Puchuri Chamorro, Sara Daniela");
    expect(t).toContain("CH 71");
  });

  it("un día de una sola cita se dice como lo que es, sin culpar al reparto", () => {
    const t = motivoDelViaje(viaje({ causa: "dia-de-una-cita" }));
    // En masculino y con el vocabulario del perfil: la unidad es el
    // curso-horario, y hay un guard que lo vigila (`generoDeLaUnidad`).
    expect(t).toContain("ningún otro curso-horario agendado");
  });

  it("sin oferta, dice que nadie de ese día declaró la hora", () => {
    expect(motivoDelViaje(viaje({ causa: "sin-oferta" }))).toContain("ninguno declaró ese horario");
  });
});

describe("AulasViajesSolitarios", () => {
  it("sin viajes solitarios no pinta nada: no hay aviso que dar", () => {
    expect(renderToStaticMarkup(<AulasViajesSolitarios viajes={[]} />)).toBe("");
  });

  it("marca sólo lo accionable y lo anuncia en el resumen", () => {
    const html = renderToStaticMarkup(
      <AulasViajesSolitarios
        viajes={[
          viaje({ causa: "dia-de-una-cita", codigo: "CH 40" }),
          viaje({
            causa: "tope",
            codigo: "CH 113",
            frenadosPorTope: [{ aplicador: "PUCHURI CHAMORRO, SARA DANIELA", lleva: 4 }],
          }),
        ]}
      />,
    );
    // Dos viajes, uno solo resoluble desde la tabla.
    expect(html).toContain("2 viajes por una sola aula");
    expect(html).toContain("1 que puedes resolver");
    // La marca cuelga del `li` de la causa `tope`, no del otro.
    expect(html.match(/es-accionable/g) ?? []).toHaveLength(1);
    const antes = html.indexOf("CH 40");
    const marca = html.indexOf("es-accionable");
    expect(marca).toBeGreaterThan(antes);
  });

  it("un solo viaje se dice en singular y sin prometer arreglo si no lo hay", () => {
    const html = renderToStaticMarkup(
      <AulasViajesSolitarios viajes={[viaje({ causa: "dia-de-una-cita" })]} />,
    );
    expect(html).toContain("1 viaje por una sola aula");
    expect(html).not.toContain("que puedes resolver");
    expect(html).not.toContain("es-accionable");
  });

  it("cada línea trae la cita completa: día, código y la ventana ocupada", () => {
    const html = renderToStaticMarkup(
      <AulasViajesSolitarios viajes={[viaje({ causa: "dia-de-una-cita" })]} />,
    );
    expect(html).toContain("martes 08/09");
    expect(html).toContain("CH 113");
    expect(html).toContain("18:15 a 19:15");
  });
});
