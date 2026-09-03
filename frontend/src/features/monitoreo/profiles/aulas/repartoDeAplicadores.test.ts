import { describe, expect, it } from "vitest";

import type { MonitoreoAulasReparto } from "../../../../api/monitoreo";
import { repartoDeAplicadores } from "./repartoDeAplicadores";

/**
 * El bloque `reparto` del dashboard (B29) convertido en modelo de vista para la
 * pestaña de Asignación. El motor ya decidió TODO —greedy determinista, equidad
 * alfabética con ceros, no_cubiertos y por_confirmar declarados—; aquí solo se
 * normaliza la frontera jsonlite y se suman los totales que la vista rotula.
 * Reordenar o recalcular sería tener dos dueños del mismo reparto.
 */

const crudo = (v: unknown): MonitoreoAulasReparto => v as MonitoreoAulasReparto;

const DIA = {
  fecha: "2026-09-11",
  asignaciones: [
    { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20" },
    { codigo: "CH 3", aplicador: "Berta Ficticia", inicio: "15:00", fin: "15:20" },
  ],
  no_cubiertos: ["CH 2"],
  por_confirmar: ["CH 7"],
};

describe("repartoDeAplicadores", () => {
  it("sin bloque no hay reparto: la sesión no cargó la disponibilidad", () => {
    expect(repartoDeAplicadores(null)).toBeNull();
    expect(repartoDeAplicadores(undefined)).toBeNull();
  });

  it("normaliza el día con su etiqueta y conserva el orden del motor", () => {
    const r = repartoDeAplicadores(crudo({
      dias: [DIA],
      equidad: [
        { aplicador: "Ana Prueba", asignadas: 1 },
        { aplicador: "Berta Ficticia", asignadas: 1 },
        { aplicador: "Mario Sintetico", asignadas: 0 },
      ],
    }))!;
    expect(r.dias).toHaveLength(1);
    expect(r.dias[0].fecha).toBe("2026-09-11");
    expect(r.dias[0].etiqueta).toBe("Viernes 11/09");
    expect(r.dias[0].asignaciones).toEqual(DIA.asignaciones);
    expect(r.dias[0].noCubiertos).toEqual(["CH 2"]);
    expect(r.dias[0].porConfirmar).toEqual(["CH 7"]);
    // El resumen de equidad viene alfabético DEL MOTOR (pin de B29) y con los
    // ceros incluidos; la vista no lo reordena ni los filtra.
    expect(r.equidad.map((e) => e.aplicador)).toEqual([
      "Ana Prueba", "Berta Ficticia", "Mario Sintetico",
    ]);
    expect(r.equidad[2].asignadas).toBe(0);
  });

  it("suma los totales que la vista rotula", () => {
    const r = repartoDeAplicadores(crudo({
      dias: [
        DIA,
        {
          fecha: "2026-09-12",
          asignaciones: [{ codigo: "CH 5", aplicador: "Ana Prueba", inicio: "09:00", fin: "09:20" }],
          no_cubiertos: [],
          por_confirmar: ["CH 8", "CH 9"],
        },
      ],
      equidad: [
        { aplicador: "Ana Prueba", asignadas: 2 },
        { aplicador: "Berta Ficticia", asignadas: 1 },
        { aplicador: "Mario Sintetico", asignadas: 0 },
      ],
    }))!;
    expect(r.citas).toBe(3);
    expect(r.sinCubrir).toBe(1);
    expect(r.porConfirmar).toBe(3);
    expect(r.conCarga).toBe(2);
    expect(r.cargaMax).toBe(2);
  });

  it("cargada pero sin agendadas = marco declarado, no null", () => {
    // El contrato B29: plan sin agendadas → `dias` vacío y equidad con todos
    // en 0. La vista tiene que poder decir «nada que repartir todavía» sin
    // confundirlo con «falta la disponibilidad».
    const r = repartoDeAplicadores(crudo({
      dias: [],
      equidad: [{ aplicador: "Ana Prueba", asignadas: 0 }],
    }))!;
    expect(r).not.toBeNull();
    expect(r.dias).toEqual([]);
    expect(r.citas).toBe(0);
    expect(r.conCarga).toBe(0);
    expect(r.equidad).toHaveLength(1);
  });

  it("sobrevive a la frontera jsonlite: escalares envueltos y códigos sueltos", () => {
    const r = repartoDeAplicadores(crudo({
      dias: [{
        fecha: ["2026-09-11"],
        asignaciones: [{ codigo: ["CH 1"], aplicador: ["Ana Prueba"], inicio: ["10:00"], fin: ["10:20"] }],
        // Un solo código puede llegar como escalar, no como lista de uno.
        no_cubiertos: "CH 2",
        por_confirmar: ["CH 7"],
      }],
      equidad: [{ aplicador: ["Ana Prueba"], asignadas: [1] }],
    }))!;
    expect(r.dias[0].asignaciones[0]).toEqual({
      codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20",
    });
    expect(r.dias[0].noCubiertos).toEqual(["CH 2"]);
    expect(r.equidad[0]).toEqual({ aplicador: "Ana Prueba", asignadas: 1 });
  });

  it("lo roto se declara en vez de tragarse: día sin fecha, asignación sin quién", () => {
    const r = repartoDeAplicadores(crudo({
      dias: [
        { asignaciones: [], no_cubiertos: [], por_confirmar: [] },
        {
          fecha: "2026-09-11",
          asignaciones: [
            { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20" },
            { codigo: "CH 9", inicio: "11:00", fin: "11:20" },
          ],
          no_cubiertos: [],
          por_confirmar: [],
        },
      ],
      equidad: [],
    }))!;
    expect(r.dias).toHaveLength(1);
    expect(r.dias[0].asignaciones).toHaveLength(1);
    expect(r.ilegibles).toBe(2);
  });
});
