import { describe, expect, test } from "vitest";

import { lasQueNoLlegan, sexoEnPalabra, tresLecturasDeCuota } from "./tresLecturasDeCuota";

const celda = (o: Record<string, unknown> = {}) => ({
  faculty: "DERECHO", sex: "F", cuota: 237, logrado: 79,
  proyeccion: 300, proyeccion_agendada: 159, proyeccion_agendada_observada: 159,
  factor_de_campo: 1, ...o,
});

describe("las tres lecturas de una celda de cuota", () => {
  test("las tres se leen y se nombran por lo que miden", () => {
    const [f] = tresLecturasDeCuota([celda()]);
    expect(f.techo).toBe(300);
    expect(f.comprometido).toBe(159);
    expect(f.conElCampo).toBe(159);
    expect(f.sexo).toBe("Mujeres");
  });

  test("lo que falta se mide contra lo COMPROMETIDO, que es lo que pide acción", () => {
    // Contra el techo daría 0 y la celda parecería resuelta: es exactamente el
    // motivo de que el panel de refuerzo no se encendiera nunca.
    const [f] = tresLecturasDeCuota([celda()]);
    expect(f.faltaComprometido).toBe(78);
  });

  test("distingue falta de AGENDA de falta de AULAS, que son dos remedios", () => {
    // El techo llega y lo comprometido no: hay plan de sobra, faltan fechas.
    expect(tresLecturasDeCuota([celda()])[0].esFaltaDeAgenda).toBe(true);
    // Ni el techo llega: agendar no basta, hay que ir al banco.
    expect(tresLecturasDeCuota([celda({ proyeccion: 200 })])[0].esFaltaDeAgenda).toBe(false);
  });

  test("una celda que ya llega con lo comprometido no falta nada", () => {
    const [f] = tresLecturasDeCuota([celda({ proyeccion_agendada: 240 })]);
    expect(f.faltaComprometido).toBe(0);
    expect(f.esFaltaDeAgenda).toBe(false);
  });

  test("`lasQueNoLlegan` ordena por brecha y descarta las que sí llegan", () => {
    const r = lasQueNoLlegan(tresLecturasDeCuota([
      celda({ faculty: "A", cuota: 100, proyeccion_agendada: 90 }),
      celda({ faculty: "B", cuota: 100, proyeccion_agendada: 50 }),
      celda({ faculty: "C", cuota: 100, proyeccion_agendada: 120 }),
    ]));
    expect(r.map((f) => f.facultad)).toEqual(["B", "A"]);
  });

  test("el factor de campo se conserva, y `null` no se disfraza de 1", () => {
    // 1 significa «el campo va como el diseño»; ausente significa «no hay con
    // qué compararlo todavía». Confundirlos borraría el aviso.
    expect(tresLecturasDeCuota([celda({ factor_de_campo: 1.08 })])[0].factorDeCampo).toBeCloseTo(1.08);
    expect(tresLecturasDeCuota([celda({ factor_de_campo: null })])[0].factorDeCampo).toBeNull();
  });

  test("los sexos se dicen en palabras y lo desconocido se nombra", () => {
    expect(sexoEnPalabra("M")).toBe("Hombres");
    expect(sexoEnPalabra("")).toBe("Sin sexo declarado");
  });

  test("una lista vacía no revienta", () => {
    expect(tresLecturasDeCuota([])).toEqual([]);
    expect(lasQueNoLlegan([])).toEqual([]);
  });
});
