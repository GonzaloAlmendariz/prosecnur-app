import { describe, expect, it } from "vitest";

import type { MonitoreoAulasReparto } from "../../../../api/monitoreo";
import { mapaDeFijaciones, repartoDeAplicadores } from "./repartoDeAplicadores";

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
    // El orden del motor se conserva; cada entrada suma las marcas B36 con
    // sus valores por defecto (greedy, sin aviso).
    expect(r.dias[0].asignaciones).toEqual(
      DIA.asignaciones.map((a) => ({ ...a, fijada: false, advertencia: "" })),
    );
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
      // B36: sin marca del motor, la asignación es del greedy y sin aviso.
      fijada: false, advertencia: "",
    });
    expect(r.dias[0].noCubiertos).toEqual(["CH 2"]);
    expect(r.equidad[0]).toEqual({ aplicador: "Ana Prueba", asignadas: 1 });
    expect(r.fijadasSinCita).toEqual([]);
  });

  it("B36: la fijación y su advertencia cruzan la frontera; lo desconocido no inventa lectura", () => {
    // Dictado (2026-09-02): «mecanismo propio de asignación y reasignación».
    // La marca `fijada` puede llegar envuelta ([true], jsonlite); una
    // advertencia fuera de la lista cerrada del motor se lee como "".
    const r = repartoDeAplicadores(crudo({
      dias: [{
        fecha: "2026-09-11",
        asignaciones: [
          { codigo: "CH 1", aplicador: "Zoe Tardia", inicio: "10:00", fin: "10:20", fijada: [true], advertencia: "sin_disponibilidad" },
          { codigo: "CH 2", aplicador: "Ana Prueba", inicio: "12:00", fin: "12:20", fijada: false, advertencia: "algo_nuevo" },
        ],
        no_cubiertos: [],
        por_confirmar: [],
      }],
      equidad: [],
      fijadas: [
        { codigo: "CH 1", aplicador: "Zoe Tardia" },
        { codigo: ["CH 99"], aplicador: ["Perico Externo"] },
        { codigo: "", aplicador: "Nadie" },
      ],
      fijadas_sin_cita: "CH 99",
    }))!;
    const [a1, a2] = r.dias[0].asignaciones;
    expect(a1.fijada).toBe(true);
    expect(a1.advertencia).toBe("sin_disponibilidad");
    expect(a2.fijada).toBe(false);
    expect(a2.advertencia).toBe("");
    expect(r.fijadasSinCita).toEqual(["CH 99"]);
    // El eco cruza como mapa completo; la entrada sin código se descarta.
    expect(r.fijadas.get("CH 1")).toBe("Zoe Tardia");
    expect(r.fijadas.get("CH 99")).toBe("Perico Externo");
    expect(r.fijadas.size).toBe(2);
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

describe("mapaDeFijaciones (B36)", () => {
  const vigentes = new Map([["CH 1", "Ana Prueba"], ["CH 99", "Zoe Tardia"]]);

  it("fijar añade sin perder las demás — la huérfana viaja intacta", () => {
    expect(mapaDeFijaciones(vigentes, "CH 2", "Berta Ficticia")).toEqual({
      "CH 1": "Ana Prueba", "CH 99": "Zoe Tardia", "CH 2": "Berta Ficticia",
    });
  });

  it("reasignar reemplaza solo esa cita", () => {
    expect(mapaDeFijaciones(vigentes, "CH 1", "Berta Ficticia")).toEqual({
      "CH 1": "Berta Ficticia", "CH 99": "Zoe Tardia",
    });
  });

  it("soltar (valor vacío) quita la cita y conserva el resto", () => {
    expect(mapaDeFijaciones(vigentes, "CH 99", "")).toEqual({ "CH 1": "Ana Prueba" });
  });
});
