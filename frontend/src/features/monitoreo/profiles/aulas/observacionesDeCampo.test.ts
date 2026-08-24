import { describe, expect, it } from "vitest";

import { observacionesDeCampo } from "./observacionesDeCampo";

const parte = (o: Record<string, unknown>) => o;

describe("observacionesDeCampo", () => {
  it("agrupa por lo que dice: lo repetido es un patrón, no N incidencias", () => {
    // El caso real del corte: 16 partes con la MISMA observación entre dos
    // equipos. Listadas una a una son dieciséis casos sueltos; agrupadas son un
    // patrón que cambia cómo se agenda.
    const r = observacionesDeCampo([
      parte({ field_note: "El docente pidió empezar al final", operational_code: "CH 1", applied_by: "Equipo 1", applied_date: "2026-08-01" }),
      parte({ field_note: "el docente pidió empezar al final.", operational_code: "CH 2", applied_by: "Equipo 4", applied_date: "2026-08-03" }),
      parte({ field_note: "Aula cambiada a última hora", operational_code: "CH 3", applied_by: "Equipo 1", applied_date: "2026-08-02" }),
      parte({ field_note: "  ", operational_code: "CH 4" }),
    ]);
    expect(r.conNota).toBe(3);
    expect(r.partes).toBe(4);
    expect(r.observaciones).toHaveLength(2);
    const primera = r.observaciones[0];
    expect(primera.aulas).toBe(2);
    // El texto es el del PRIMERO tal como se escribió, no la clave normalizada.
    expect(primera.texto).toBe("El docente pidió empezar al final");
    expect(primera.codigos).toEqual(["CH 1", "CH 2"]);
    expect(primera.aplicadores).toEqual(["Equipo 1", "Equipo 4"]);
    expect(primera.ultima).toBe("2026-08-03");
  });

  it("lo repetido va primero, y a igualdad lo más reciente", () => {
    const r = observacionesDeCampo([
      parte({ field_note: "Sola", applied_date: "2026-08-09" }),
      parte({ field_note: "Dos veces", applied_date: "2026-08-01" }),
      parte({ field_note: "Dos veces", applied_date: "2026-08-02" }),
      parte({ field_note: "Otra sola", applied_date: "2026-08-10" }),
    ]);
    expect(r.observaciones.map((o) => o.texto)).toEqual(["Dos veces", "Otra sola", "Sola"]);
  });

  it("sin observaciones no inventa ninguna", () => {
    const r = observacionesDeCampo([parte({ operational_code: "CH 1" })]);
    expect(r).toEqual({ observaciones: [], conNota: 0, partes: 1 });
  });

  it("el mismo aplicador no se repite en la lista de quién lo reportó", () => {
    const r = observacionesDeCampo([
      parte({ field_note: "X", applied_by: "Equipo 1" }),
      parte({ field_note: "X", applied_by: "Equipo 1" }),
      parte({ field_note: "X", applied_by: "Equipo 2" }),
    ]);
    expect(r.observaciones[0].aplicadores).toEqual(["Equipo 1", "Equipo 2"]);
    expect(r.observaciones[0].aulas).toBe(3);
  });
});

/**
 * Las observaciones llegan por DOS caminos y el panel leía uno.
 *
 * El registro de esta app guarda su `field_note` en la fila del plan; el parte
 * del libro lo trae en su propia hoja. El panel leía sólo los partes mientras su
 * vacío decía «se escriben al registrar un aula» — el camino que no miraba.
 *
 * Medido el 2026-08-23 sobre el estudio de 193: registrando un aula con
 * observación, la nota quedaba en el plan, `aulas_aplicadas` subía a 1 y el
 * panel seguía enseñando cero. Es media reparación de un defecto que este mismo
 * archivo documenta: se le dio superficie de lectura al `field_note` del libro y
 * se dejó sin ella al del registro, que era el caso original.
 */
describe("observacionesDeCampo · las dos fuentes", () => {
  const fila = (extra: Record<string, unknown>) => ({ operational_code: "CH 1", ...extra });

  it("lee la nota del registro de la app, no sólo la del libro", () => {
    const r = observacionesDeCampo([], [fila({ field_note: "El docente pidió empezar al final" })]);
    expect(r.observaciones).toHaveLength(1);
    expect(r.conNota).toBe(1);
    expect(r.observaciones[0]?.texto).toContain("empezar al final");
  });

  it("junta las dos fuentes y agrupa por lo que dicen", () => {
    const r = observacionesDeCampo(
      [fila({ operational_code: "CH 2", field_note: "Aula cambiada" })],
      [fila({ operational_code: "CH 3", field_note: "aula cambiada." })],
    );
    // Mismo texto en dos aulas distintas: un patrón, no dos incidencias sueltas.
    expect(r.observaciones).toHaveLength(1);
    expect(r.observaciones[0]?.aulas).toBe(2);
    expect(r.observaciones[0]?.codigos).toEqual(["CH 2", "CH 3"]);
  });

  it("la misma aula con la misma nota por los dos caminos cuenta UNA vez", () => {
    // Se registró en la app y además se transcribió al libro. Es un aula.
    const r = observacionesDeCampo(
      [fila({ field_note: "Sin novedad" })],
      [fila({ field_note: "sin novedad" })],
    );
    expect(r.observaciones).toHaveLength(1);
    expect(r.observaciones[0]?.aulas).toBe(1);
    expect(r.conNota).toBe(1);
  });

  it("pero dos notas DISTINTAS de la misma aula son dos cosas que alguien vio", () => {
    const r = observacionesDeCampo(
      [fila({ field_note: "El proyector no andaba" })],
      [fila({ field_note: "El docente pidió el final de la clase" })],
    );
    expect(r.observaciones).toHaveLength(2);
  });

  it("el denominador cuenta cada aula una vez, no la suma de las dos listas", () => {
    // Sumar las listas daría «2 aulas» sobre un operativo de una.
    const r = observacionesDeCampo([fila({})], [fila({})]);
    expect(r.partes).toBe(1);
  });

  /**
   * **El denominador son las aulas que pasaron por campo, no la agenda.**
   *
   * El panel recibe la agenda entera como `registros` —ahí es donde el registro
   * de esta app deja su `field_note`—, así que una agenda de 2.616 filas con
   * diez aplicadas publicaba «4 de 2.616 partes traen observación». Las cuatro
   * eran ciertas; el denominador convertía un tercio del campo en un 0,15 %.
   */
  describe("el denominador sólo cuenta lo que pasó por campo", () => {
    const agenda = [
      { operational_code: "CH 1", operational_status: "aplicada", field_note: "El proyector no andaba" },
      { operational_code: "CH 2", applied_at: "2026-09-01 08:00" },
      { operational_code: "CH 3", effective_surveys: 21 },
      // Las tres siguientes son agenda pura: nadie estuvo ahí todavía.
      { operational_code: "CH 4", operational_status: "planificada" },
      { operational_code: "CH 5" },
      { operational_code: "CH 6", operational_status: "planificada", effective_surveys: 0 },
    ];

    it("no cuenta las filas de agenda sin aplicar", () => {
      const r = observacionesDeCampo([], agenda);
      // Tres pasaron por campo por tres señales distintas; tres no pasaron.
      expect(r.partes).toBe(3);
      expect(r.conNota).toBe(1);
    });

    it("un aula con parte en el libro cuenta aunque su fila de agenda esté cruda", () => {
      // El parte llega del Excel y la agenda todavía no lo refleja: la unidad
      // pasó por campo igual, y descartarla escondería su observación.
      const r = observacionesDeCampo(
        [{ operational_code: "CH 9", field_note: "Aula cambiada a última hora" }],
        [...agenda, { operational_code: "CH 9" }],
      );
      expect(r.partes).toBe(4);
      expect(r.conNota).toBe(2);
    });
  });
});
