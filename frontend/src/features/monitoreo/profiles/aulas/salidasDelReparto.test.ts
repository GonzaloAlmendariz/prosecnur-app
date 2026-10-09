import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDisponibilidad, MonitoreoAulasReparto } from "../../../../api/monitoreo";
import { mallaDeOferta } from "./disponibilidadDeAplicadores";
import { repartoDeAplicadores } from "./repartoDeAplicadores";
import {
  claveDeCita, diaDeSemanaDe, salidasDeDescubiertos, salidasDeLibres,
  salidasDeViajesSolitarios, ventanasPorCita,
} from "./salidasDelReparto";

/**
 * Dictado 2026-09-04: «¿qué cursos se quedan sin aula? ¿Por qué no hay
 * disponibilidad a esa hora? ¿Quiénes tienen disponibilidad a esa hora? No me
 * estás dando soluciones ni formas de poder yo resolver las cosas».
 *
 * El reparto ya decía el hecho; aquí se prueba que además diga la causa y a
 * quién tocar. 2026-09-07 es lunes.
 */
const oferta = (dias: Array<{ dia: string; franjas: Array<{ inicio: string; fin: string; nombres: string[] }> }>) =>
  mallaDeOferta({
    dias: dias.map((d) => ({
      dia: d.dia,
      franjas: d.franjas.map((f) => ({ ...f, disponibles: f.nombres.length })),
    })),
  } as unknown as MonitoreoAulasDisponibilidad);

const reparto = (crudo: unknown) => repartoDeAplicadores(crudo as MonitoreoAulasReparto)!;

const VENTANAS = new Map([
  [claveDeCita("2026-09-07", "CH 9"), { inicio: "11:30", fin: "12:00" }],
]);

describe("diaDeSemanaDe", () => {
  it("da la clave del motor, sin tilde", () => {
    expect(diaDeSemanaDe("2026-09-07")).toBe("lunes");
    expect(diaDeSemanaDe("2026-09-09")).toBe("miercoles");
  });

  it("una fecha imposible no inventa día", () => {
    expect(diaDeSemanaDe("2026-02-31")).toBeNull();
    expect(diaDeSemanaDe("")).toBeNull();
  });
});

describe("salidasDeDescubiertos", () => {
  const REPARTO_CON_HUECO = {
    dias: [{
      fecha: "2026-09-07",
      asignaciones: [
        { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "11:30", fin: "12:00" },
        { codigo: "CH 2", aplicador: "Berta Ficticia", inicio: "11:45", fin: "12:15" },
      ],
      no_cubiertos: ["CH 9"],
      por_confirmar: [],
    }],
    equidad: [
      { aplicador: "Ana Prueba", asignadas: 1 },
      { aplicador: "Berta Ficticia", asignadas: 1 },
    ],
    // B71: el protocolo del operativo. Sin él la ocupación arrancaría en la
    // hora pactada y este helper mediría con una vara que el motor no usa.
    preparacion_min: 30,
  };

  it("nadie con ese horario: la salida NO está en el reparto y se dice así", () => {
    // La oferta del lunes es de mañana temprano; nadie cubre las 11:30.
    const malla = oferta([{ dia: "lunes", franjas: [{ inicio: "08:00", fin: "08:30", nombres: ["Ana Prueba"] }] }]);
    const [s] = salidasDeDescubiertos(reparto(REPARTO_CON_HUECO), malla, VENTANAS);
    expect(s.causa).toBe("sin-oferta");
    expect(s.codigo).toBe("CH 9");
    expect(s.inicio).toBe("11:30");
    expect(s.conHorario).toEqual([]);
  });

  it("hay gente con ese horario pero está tomada: se nombra a quién soltar", () => {
    // La oferta cubre desde el RECOJO (11:00) hasta el fin: es la ventana que
    // el motor ocupa, y la que este helper tiene que medir.
    const malla = oferta([{
      dia: "lunes",
      franjas: [
        { inicio: "11:00", fin: "11:30", nombres: ["Ana Prueba", "Berta Ficticia"] },
        { inicio: "11:30", fin: "12:00", nombres: ["Ana Prueba", "Berta Ficticia"] },
      ],
    }]);
    const [s] = salidasDeDescubiertos(reparto(REPARTO_CON_HUECO), malla, VENTANAS);
    expect(s.causa).toBe("ocupados");
    expect(s.desdeRecojo).toBe("11:00");
    expect(s.conHorario).toEqual(["Ana Prueba", "Berta Ficticia"]);
    // El par (persona, cita) es lo accionable: soltando una de ésas se abre.
    expect(s.ocupados).toEqual([
      { aplicador: "Ana Prueba", porCodigo: "CH 1" },
      { aplicador: "Berta Ficticia", porCodigo: "CH 2" },
    ]);
  });

  it("una cita que cruza dos tramos exige a la persona en los DOS", () => {
    // Ana sólo declaró el primer tramo; Berta los dos. Una cita 11:30 a 12:30
    // cruza ambos, así que Ana no la cubre.
    const malla = oferta([{
      dia: "lunes",
      franjas: [
        { inicio: "11:00", fin: "11:30", nombres: ["Ana Prueba", "Berta Ficticia"] },
        { inicio: "11:30", fin: "12:00", nombres: ["Ana Prueba", "Berta Ficticia"] },
        { inicio: "12:00", fin: "12:30", nombres: ["Berta Ficticia"] },
      ],
    }]);
    const larga = new Map([[claveDeCita("2026-09-07", "CH 9"), { inicio: "11:30", fin: "12:30" }]]);
    const [s] = salidasDeDescubiertos(reparto(REPARTO_CON_HUECO), malla, larga);
    expect(s.conHorario).toEqual(["Berta Ficticia"]);
  });

  it("sin hora legible no afirma que nadie pueda: lo declara", () => {
    const malla = oferta([{ dia: "lunes", franjas: [{ inicio: "11:30", fin: "12:00", nombres: ["Ana Prueba"] }] }]);
    const [s] = salidasDeDescubiertos(reparto(REPARTO_CON_HUECO), malla, new Map());
    expect(s.causa).toBe("sin-hora");
    expect(s.conHorario).toEqual([]);
  });

  it("sin la malla cargada tampoco inventa una causa de oferta", () => {
    const [s] = salidasDeDescubiertos(reparto(REPARTO_CON_HUECO), null, VENTANAS);
    expect(s.causa).toBe("sin-hora");
  });

  it("un día sin descubiertos no produce salida", () => {
    const limpio = reparto({
      dias: [{ fecha: "2026-09-07", asignaciones: [], no_cubiertos: [], por_confirmar: [] }],
      equidad: [],
    });
    expect(salidasDeDescubiertos(limpio, null, VENTANAS)).toEqual([]);
  });
});

describe("salidasDeLibres", () => {
  const CON_LIBRE = {
    dias: [{
      fecha: "2026-09-07",
      asignaciones: [{ codigo: "CH 1", aplicador: "Ana Prueba", inicio: "11:30", fin: "12:00" }],
      no_cubiertos: [], por_confirmar: [],
    }],
    equidad: [
      { aplicador: "Ana Prueba", asignadas: 1 },
      { aplicador: "Mario Sintetico", asignadas: 0 },
    ],
  };

  it("dice QUÉ CUBRE quien quedó sin nada, de punta a punta del día", () => {
    const malla = oferta([{
      dia: "martes",
      franjas: [
        { inicio: "08:00", fin: "08:30", nombres: ["Mario Sintetico"] },
        { inicio: "08:30", fin: "09:00", nombres: ["Mario Sintetico"] },
      ],
    }]);
    expect(salidasDeLibres(reparto(CON_LIBRE), malla)).toEqual([
      { aplicador: "Mario Sintetico", cubre: [{ dia: "martes", desde: "08:00", hasta: "09:00" }] },
    ]);
  });

  it("quien no declaró ninguna hora sale con la lista vacía, no ausente", () => {
    const malla = oferta([{ dia: "martes", franjas: [{ inicio: "08:00", fin: "08:30", nombres: ["Ana Prueba"] }] }]);
    expect(salidasDeLibres(reparto(CON_LIBRE), malla)).toEqual([
      { aplicador: "Mario Sintetico", cubre: [] },
    ]);
  });

  it("sin malla cargada lista igual a los libres: el vacío no borra a la persona", () => {
    expect(salidasDeLibres(reparto(CON_LIBRE), null)).toEqual([
      { aplicador: "Mario Sintetico", cubre: [] },
    ]);
  });
});

describe("ventanasPorCita", () => {
  it("indexa por fecha y código, con las dos puntas", () => {
    const m = ventanasPorCita({
      dias: [{
        fecha: "2026-09-07",
        ventanas: [{ codigo: "CH 1", inicio: "11:30", fin: "12:00", confirmada: true }],
      }],
    });
    expect(m.get(claveDeCita("2026-09-07", "CH 1"))).toEqual({ inicio: "11:30", fin: "12:00" });
    // El mismo código en otro día no se pisa: la clave lleva la fecha.
    expect(m.get(claveDeCita("2026-09-14", "CH 1"))).toBeUndefined();
  });

  it("aguanta los escalares envueltos de la frontera jsonlite", () => {
    const m = ventanasPorCita({
      dias: [{ fecha: ["2026-09-07"], ventanas: [{ codigo: ["CH 1"], inicio: ["09:00"], fin: ["09:30"] }] }],
    });
    expect(m.get(claveDeCita("2026-09-07", "CH 1"))).toEqual({ inicio: "09:00", fin: "09:30" });
  });

  it("un bloque ausente da mapa vacío, no revienta", () => {
    expect(ventanasPorCita(null).size).toBe(0);
    expect(ventanasPorCita({}).size).toBe(0);
  });
});

/**
 * **La media hora de preparación manda, no la hora pactada.**
 *
 * Medido sobre el operativo el 2026-09-04: CH 81, pactada 08:15, salió con
 * «17 con ese horario» y ninguno ocupado. Imposible: si alguno pudiera, el
 * greedy lo habría puesto. Esas 17 personas declaran desde las 08:00 y su
 * recojo caía a las 07:45. Medir contra la pactada fabricaba una salida que
 * no existe, que es peor que no decir nada.
 */
describe("la ocupación empieza en el recojo, no en la hora pactada", () => {
  const CON_HUECO_TEMPRANO = {
    dias: [{
      fecha: "2026-09-10",
      asignaciones: [],
      no_cubiertos: ["CH 81"],
      por_confirmar: [],
    }],
    equidad: [{ aplicador: "Ana Prueba", asignadas: 0 }],
    // B71: el eco del protocolo que el motor usa para ocupar la agenda.
    preparacion_min: 30,
  };
  const VENT = new Map([[claveDeCita("2026-09-10", "CH 81"), { inicio: "08:15", fin: "08:45" }]]);

  it("quien abre a las 08:00 NO puede una cita de 08:15: su recojo es 07:45", () => {
    // 2026-09-10 es jueves.
    const malla = oferta([{
      dia: "jueves",
      franjas: [
        { inicio: "08:00", fin: "08:30", nombres: ["Ana Prueba"] },
        { inicio: "08:30", fin: "09:00", nombres: ["Ana Prueba"] },
      ],
    }]);
    const [s] = salidasDeDescubiertos(reparto(CON_HUECO_TEMPRANO), malla, VENT);
    expect(s.causa).toBe("sin-oferta");
    expect(s.conHorario).toEqual([]);
    // Y el aviso puede decir DESDE cuándo hace falta que esté libre.
    expect(s.desdeRecojo).toBe("07:45");
  });

  it("quien abre a las 07:30 sí puede: cubre el recojo y la aplicación", () => {
    const malla = oferta([{
      dia: "jueves",
      franjas: [
        { inicio: "07:30", fin: "08:00", nombres: ["Ana Prueba"] },
        { inicio: "08:00", fin: "08:30", nombres: ["Ana Prueba"] },
        { inicio: "08:30", fin: "09:00", nombres: ["Ana Prueba"] },
      ],
    }]);
    const [s] = salidasDeDescubiertos(reparto(CON_HUECO_TEMPRANO), malla, VENT);
    expect(s.conHorario).toEqual(["Ana Prueba"]);
  });
});


/**
 * **Los viajes por una sola aula, con su motivo.**
 *
 * Sobre el operativo del 2026-09-04 el motor bajó de 18 viajes solitarios a 9,
 * y los 9 se midieron uno por uno: ninguno era un fallo del reparto. Decirlos
 * como un número suelto invita a pensar que sí, así que cada uno viaja con la
 * causa que decide qué hacer con él.
 *
 * Los casos de aquí son los mismos que se midieron en el operativo, reducidos
 * a lo mínimo que los distingue.
 */
describe("salidasDeViajesSolitarios", () => {
  // La malla es una REJILLA DE 30 MINUTOS: `quienesCubren` marca los tramos
  // como `[min, min+30)`. Una franja de catorce horas declarada de una pieza
  // sólo ocupa el primer tramo, así que hay que expandirla — el mismo detalle
  // que hace que los tests de arriba escriban sus franjas media hora a media
  // hora.
  const continua = (desde: string, hasta: string, nombres: string[]) => {
    const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
    const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const out = [];
    for (let m = min(desde); m < min(hasta); m += 30) {
      out.push({ inicio: hh(m), fin: hh(m + 30), nombres });
    }
    return out;
  };
  const dia = (asignaciones: Array<Record<string, unknown>>) => ({
    fecha: "2026-09-07", asignaciones, no_cubiertos: [], por_confirmar: [],
  });
  const cita = (aplicador: string, codigo: string, recojo: string, inicio: string, fin: string) =>
    ({ codigo, aplicador, recojo, inicio, fin, salida: inicio, fijada: false });

  it("un día con UNA sola cita no tiene arreglo, y lo dice así", () => {
    const r = reparto({
      concentrado: true, tope_por_viaje: 4, preparacion_min: 30,
      dias: [dia([cita("Ana Uno", "CH 1", "09:30", "10:00", "10:30")])],
      equidad: [],
    });
    const s = salidasDeViajesSolitarios(r, null);
    expect(s).toHaveLength(1);
    expect(s[0].causa).toBe("dia-de-una-cita");
    expect(s[0].aplicador).toBe("Ana Uno");
  });

  it("cuando el ÚNICO obstáculo es el tope del día, nombra a quien podría", () => {
    // Beto tiene el horario entero y está libre a esa hora: lo frena que ya
    // lleve el tope. Es el único caso que el usuario resuelve solo, fijando
    // la cita a mano.
    const malla = oferta([{ dia: "lunes", franjas: continua("08:00", "22:00", ["Ana Uno", "Beto Dos"]) }]);
    const r = reparto({
      concentrado: true, tope_por_viaje: 2, preparacion_min: 30,
      dias: [dia([
        cita("Beto Dos", "CH 1", "08:30", "09:00", "09:30"),
        cita("Beto Dos", "CH 2", "09:30", "10:00", "10:30"),
        cita("Ana Uno", "CH 3", "17:30", "18:00", "18:30"),
      ])],
      equidad: [],
    });
    const s = salidasDeViajesSolitarios(r, malla);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      aplicador: "Ana Uno", codigo: "CH 3", causa: "tope",
      frenadosPorTope: [{ aplicador: "Beto Dos", lleva: 2 }],
    });
  });

  it("si a los demás les choca la hora, los nombra con la cita que los tiene", () => {
    // El choque real del operativo: dos aulas a las 19:30 del mismo día.
    // Hacen falta dos personas sí o sí, y eso no es negociable.
    const malla = oferta([{ dia: "lunes", franjas: continua("08:00", "22:00", ["Ana Uno", "Beto Dos"]) }]);
    const r = reparto({
      concentrado: true, tope_por_viaje: 4, preparacion_min: 30,
      dias: [dia([
        cita("Ana Uno", "CH 1", "19:00", "19:30", "20:00"),
        cita("Beto Dos", "CH 2", "19:00", "19:30", "20:00"),
      ])],
      equidad: [],
    });
    const s = salidasDeViajesSolitarios(r, malla);
    expect(s).toHaveLength(2);
    expect(s.map((x) => x.causa)).toEqual(["ocupados", "ocupados"]);
    expect(s[0].ocupados).toEqual([{ aplicador: "Beto Dos", porCodigo: "CH 2" }]);
  });

  it("si nadie del día declara ese horario, no culpa al tope", () => {
    const malla = oferta([{ dia: "lunes", franjas: [
      ...continua("08:00", "12:00", ["Beto Dos"]),
      ...continua("17:00", "20:00", ["Ana Uno"]),
    ] }]);
    const r = reparto({
      concentrado: true, tope_por_viaje: 4, preparacion_min: 30,
      dias: [dia([
        cita("Beto Dos", "CH 1", "08:30", "09:00", "09:30"),
        cita("Beto Dos", "CH 2", "09:30", "10:00", "10:30"),
        cita("Ana Uno", "CH 3", "17:30", "18:00", "18:30"),
      ])],
      equidad: [],
    });
    const s = salidasDeViajesSolitarios(r, malla);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ causa: "sin-oferta", frenadosPorTope: [], ocupados: [] });
  });

  it("quien hace dos o más en el día no aparece: no es un viaje solitario", () => {
    const r = reparto({
      concentrado: true, tope_por_viaje: 4, preparacion_min: 30,
      dias: [dia([
        cita("Ana Uno", "CH 1", "08:30", "09:00", "09:30"),
        cita("Ana Uno", "CH 2", "09:30", "10:00", "10:30"),
      ])],
      equidad: [],
    });
    expect(salidasDeViajesSolitarios(r, null)).toEqual([]);
  });
});
