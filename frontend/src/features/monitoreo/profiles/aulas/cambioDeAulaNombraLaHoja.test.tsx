// Qué defiende este archivo: que cuando no se puede comparar el salón real con
// el agendado, el panel diga CUÁL de las dos hojas falta.
//
// El texto anterior era siempre «N sin salón reconocible en una de las dos
// hojas». Con partes de campo y sin plan agendado —el estado exacto de un
// proyecto cuyo plan de recolección quedó desfasado del sorteo vigente— ese
// texto manda a revisar el libro de campo, que está bien, en vez del plan, que
// es el que falta. Un rótulo que vale igual para dos diagnósticos opuestos
// esconde el que decide.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { aulaRealVsAgendada } from "./aulaRealVsAgendada";
import { AulasCambioDeAula } from "./AulasCambioDeAula";

const fila = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

describe("aulaRealVsAgendada conserva POR QUÉ no se pudo comparar", () => {
  it("separa el salón que falta en el parte del que falta en el plan", () => {
    const r = aulaRealVsAgendada(
      [
        fila({ operational_code: "CH 1", actual_room: "por confirmar" }), // falta el real
        fila({ operational_code: "CH 2", actual_room: "L321" }), // falta el agendado
      ],
      [fila({ operational_code: "CH 1", label: "MAR 08:00 L321" })],
    );
    expect(r.sinComparar).toBe(2);
    expect(r.sinSalonReal).toBe(1);
    expect(r.sinSalonAgendado).toBe(1);
  });

  it("una fila a la que le faltan las dos suma en ambas causas", () => {
    const r = aulaRealVsAgendada(
      [fila({ operational_code: "CH 9", actual_room: "" })],
      [],
    );
    expect(r.sinSalonReal).toBe(1);
    expect(r.sinSalonAgendado).toBe(1);
  });

  it("cuenta los cursos-horario del plan que sí traen salón", () => {
    const r = aulaRealVsAgendada(
      [],
      [
        fila({ operational_code: "CH 1", label: "MAR 08:00 L321" }),
        fila({ operational_code: "CH 2", label: "sin salón" }),
      ],
    );
    expect(r.planConSalon).toBe(1);
  });
});

describe("el panel nombra la hoja que falta", () => {
  const render = (partes: MonitoreoRow[], plan: MonitoreoRow[]) =>
    renderToStaticMarkup(<AulasCambioDeAula partes={partes} plan={plan} />);

  it("con partes y sin plan acusa al PLAN, no al libro de campo", () => {
    const html = render(
      [
        fila({ operational_code: "CH 1", actual_room: "L321" }),
        fila({ operational_code: "CH 2", actual_room: "H210" }),
      ],
      [],
    );
    expect(html).toContain("el plan agendado");
    expect(html).toContain("no hay contra qué comparar");
    // Lo que NO puede decir: mandar a mirar la hoja que está bien.
    expect(html).not.toContain("una de las dos hojas");
    expect(html).toContain("2 partes");
  });

  it("con plan completo y partes sin salón acusa al PARTE", () => {
    const html = render(
      [fila({ operational_code: "CH 1", actual_room: "por confirmar" })],
      [fila({ operational_code: "CH 1", label: "MAR 08:00 L321" })],
    );
    expect(html).toContain("sin salón anotado en el parte de campo");
    expect(html).not.toContain("una de las dos hojas");
  });

  it("con las dos causas mezcladas sí dice «una de las dos hojas»", () => {
    // Ahí el rótulo genérico es el honesto: ninguna de las dos hojas explica
    // sola el caso, y nombrar una sería inventar el diagnóstico.
    const html = render(
      [
        fila({ operational_code: "CH 1", actual_room: "por confirmar" }),
        fila({ operational_code: "CH 2", actual_room: "L321" }),
        fila({ operational_code: "CH 3", actual_room: "H210" }),
      ],
      [
        fila({ operational_code: "CH 1", label: "MAR 08:00 L321" }),
        fila({ operational_code: "CH 3", label: "JUE 10:00 H210" }),
      ],
    );
    expect(html).toContain("una de las dos hojas");
  });

  it("sin partes se retira: la tabla de al lado ya lo dice", () => {
    expect(render([], [])).toBe("");
  });
});
