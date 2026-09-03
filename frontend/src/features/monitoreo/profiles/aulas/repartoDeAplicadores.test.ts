import { describe, expect, it } from "vitest";

import type { MonitoreoAulasReparto } from "../../../../api/monitoreo";
import { mapaDeFijaciones, repartoDeAplicadores, textoDelDespliegue, veredictoDeEquidad } from "./repartoDeAplicadores";

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
    // sus valores por defecto (greedy, sin aviso) y las horas del protocolo
    // B71 vacías cuando el motor no las mandó.
    expect(r.dias[0].asignaciones).toEqual(
      DIA.asignaciones.map((a) => ({ ...a, fijada: false, advertencia: "", recojo: "", salida: "" })),
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
      // B36: sin marca del motor, la asignación es del greedy y sin aviso;
      // B71: sin horas del protocolo, vacías declaradas.
      fijada: false, advertencia: "", recojo: "", salida: "",
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

describe("textoDelDespliegue — el despliegue del día listo para el chat", () => {
  it("una línea por cita en orden de hora, con lugar cuando se conoce, y lo descubierto declarado", () => {
    const dia = {
      fecha: "2026-09-07", etiqueta: "Lunes 07/09",
      asignaciones: [
        // B70/B71: ventanas de 30 y horas del protocolo dichas por el motor.
        { codigo: "CH 7", aplicador: "Aguilar Cuya, Renzo", inicio: "11:30", fin: "12:00", recojo: "11:00", salida: "11:15", fijada: false, advertencia: "" as const },
        { codigo: "CH 9", aplicador: "Nolasco Rivera, Diego", inicio: "19:45", fin: "20:15", recojo: "19:15", salida: "19:30", fijada: false, advertencia: "" as const },
      ],
      noCubiertos: ["CH 55"], porConfirmar: [],
    };
    expect(textoDelDespliegue(dia, new Map([["CH 7", "A703"]]))).toBe([
      // Jerga fuera (dictado 2026-09-03): «A×1» pasó a palabras del lector.
      "Despliegue Lunes 07/09 — 1 aplicación en A",
      "Materiales se recogen 30 min antes; salida al aula 15 min antes de la hora pactada.",
      "• 11:30–12:00 A703 · CH 7 — Aguilar Cuya, Renzo (recojo 11:00)",
      "• 19:45–20:15 CH 9 — Nolasco Rivera, Diego (recojo 19:15)",
      "Sin nadie asignado: CH 55",
    ].join("\n"));
  });

  it("sin descubiertos no hay cola fantasma", () => {
    const dia = { fecha: "2026-09-07", etiqueta: "Lunes 07/09", asignaciones: [], noCubiertos: [], porConfirmar: [] };
    expect(textoDelDespliegue(dia)).toBe("Despliegue Lunes 07/09");
  });
});

describe("veredictoDeEquidad (B66) — la equidad DICHA, no inferida de barras", () => {
  // Dictado 2026-09-03: «no tengo ninguna forma de ver porque esto es
  // equitativo». El juicio corre entre quienes salen; los libres y lo fijado
  // se declaran como causas, no se esconden.
  const armar = (equidad: { aplicador: string; asignadas: number }[], dias: unknown[] = [DIA]) =>
    repartoDeAplicadores(crudo({ dias, equidad }))!;

  it("diferencia ≤ 1 entre quienes salen = parejo, con el rango dicho", () => {
    const v = veredictoDeEquidad(armar([
      { aplicador: "Ana Prueba", asignadas: 1 },
      { aplicador: "Berta Ficticia", asignadas: 2 },
    ]))!;
    expect(v.parejo).toBe(true);
    expect(v.texto).toContain("Reparto parejo: cargas entre 1 y 2 — diferencia máxima 1 cita");
  });

  it("todos con la misma carga lo dice sin rango fantasma", () => {
    const v = veredictoDeEquidad(armar([
      { aplicador: "Ana Prueba", asignadas: 1 },
      { aplicador: "Berta Ficticia", asignadas: 1 },
    ]))!;
    expect(v.parejo).toBe(true);
    expect(v.texto).toContain("cada quien lleva 1 cita");
  });

  it("diferencia > 1 se declara con su causa; el cero no entra al rango pero se cuenta como libre", () => {
    const v = veredictoDeEquidad(armar([
      { aplicador: "Ana Prueba", asignadas: 1 },
      { aplicador: "Berta Ficticia", asignadas: 4 },
      { aplicador: "Mario Sintetico", asignadas: 0 },
    ]))!;
    expect(v.parejo).toBe(false);
    expect(v.texto).toContain("Cargas entre 1 y 4 — diferencia de 3 citas");
    expect(v.texto).toContain("el desbalance viene de la disponibilidad de cada quien");
    expect(v.texto).toContain("1 queda libre — sin cita en sus horarios");
  });

  it("con fijadas a mano, la causa las nombra", () => {
    const diaFijado = {
      ...DIA,
      asignaciones: [
        { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20", fijada: true },
        { codigo: "CH 3", aplicador: "Ana Prueba", inicio: "15:00", fin: "15:20", fijada: true },
        { codigo: "CH 5", aplicador: "Ana Prueba", inicio: "17:00", fin: "17:20" },
      ],
    };
    const v = veredictoDeEquidad(armar([
      { aplicador: "Ana Prueba", asignadas: 3 },
      { aplicador: "Berta Ficticia", asignadas: 1 },
    ], [diaFijado]))!;
    expect(v.parejo).toBe(false);
    expect(v.texto).toContain("el desbalance viene de la disponibilidad y de lo fijado a mano");
  });

  it("parejo con fijadas: se dice cuántas van incluidas", () => {
    const diaFijado = {
      ...DIA,
      asignaciones: [
        { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20", fijada: true },
        { codigo: "CH 3", aplicador: "Berta Ficticia", inicio: "15:00", fin: "15:20" },
      ],
    };
    const v = veredictoDeEquidad(armar([
      { aplicador: "Ana Prueba", asignadas: 1 },
      { aplicador: "Berta Ficticia", asignadas: 1 },
    ], [diaFijado]))!;
    expect(v.parejo).toBe(true);
    expect(v.texto).toContain("1 fijada a mano incluida");
  });

  it("sin citas no hay veredicto: el vacío ya tiene su marco (C3)", () => {
    const sinCitas = repartoDeAplicadores(crudo({
      dias: [],
      equidad: [{ aplicador: "Ana Prueba", asignadas: 0 }],
    }))!;
    expect(veredictoDeEquidad(sinCitas)).toBeNull();
  });
});

describe("B75 — el rango de despliegue cruza la frontera", () => {
  it("lo aplazado llega por fecha con su etiqueta, y el rango saneado viaja", () => {
    const r = repartoDeAplicadores(crudo({
      dias: [DIA],
      equidad: [{ aplicador: "Ana Prueba", asignadas: 2 }],
      fuera_de_rango: [
        { fecha: "2026-09-18", codigos: ["CH 3"], por_confirmar: [] },
        // Un solo código puede llegar como escalar (jsonlite).
        { fecha: "2026-09-19", codigos: [], por_confirmar: "CH 4" },
      ],
      rango: { desde: "2026-09-07", hasta: "2026-09-13" },
    }))!;
    expect(r.fueraDeRango).toEqual([
      { fecha: "2026-09-18", etiqueta: "Viernes 18/09", codigos: ["CH 3"], porConfirmar: [] },
      { fecha: "2026-09-19", etiqueta: "Sábado 19/09", codigos: [], porConfirmar: ["CH 4"] },
    ]);
    expect(r.rango).toEqual({ desde: "2026-09-07", hasta: "2026-09-13" });
  });

  it("sin rango: lista vacía y null — todo el horizonte, sin inventar", () => {
    const r = repartoDeAplicadores(crudo({ dias: [DIA], equidad: [] }))!;
    expect(r.fueraDeRango).toEqual([]);
    expect(r.rango).toBeNull();
  });
});
