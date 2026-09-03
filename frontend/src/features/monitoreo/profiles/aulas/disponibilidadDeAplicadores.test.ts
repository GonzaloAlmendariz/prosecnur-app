import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDisponibilidad } from "../../../../api/monitoreo";
import { calcularCarga } from "./cargaDeCampo";
import { columnasVivas, mallaDeOferta } from "./disponibilidadDeAplicadores";

/**
 * La malla de OFERTA es el espejo de la de demanda (dictado 2026-09-02: «deben
 * haber tres cuadros/visualizaciones: Patrón semanal, Calendario y
 * Disponibilidad de aplicadores»): misma geometría de 30 minutos, mismo orden
 * de días, mismo eje horario. Estos tests fijan ese espejo y la frontera
 * jsonlite del bloque `disponibilidad` del dashboard (B29).
 */

const franja = (inicio: string, fin: string, nombres: string[]) => ({
  inicio,
  fin,
  disponibles: nombres.length,
  nombres,
});

const bloque = (dias: unknown): MonitoreoAulasDisponibilidad =>
  ({ dias }) as unknown as MonitoreoAulasDisponibilidad;

describe("mallaDeOferta", () => {
  it("sin bloque no hay malla: la sesión no cargó la disponibilidad", () => {
    // `null`/ausente ≠ vacío: sin la clave en sesión el dashboard NO publica el
    // bloque, y la vista tiene que poder decir «falta cargarla» (C5), no
    // pintar una malla de ceros que parezca «nadie puede».
    expect(mallaDeOferta(null)).toBeNull();
    expect(mallaDeOferta(undefined)).toBeNull();
  });

  it("cargada pero vacía = marco declarado con ceros, no null", () => {
    const m = mallaDeOferta(bloque([]));
    expect(m).not.toBeNull();
    expect(m!.filas.map((f) => f.etiqueta)).toEqual([
      "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
    ]);
    expect(m!.aplicadores).toBe(0);
    expect(m!.pico).toBeNull();
    expect(m!.disponibles.every((fila) => fila.every((n) => n === 0))).toBe(true);
  });

  it("usa EXACTAMENTE el eje horario de la malla de demanda", () => {
    // La lectura conjunta exige un solo dueño del eje: si la oferta inventara
    // el suyo, las columnas de demanda y oferta dejarían de compararse.
    const demanda = calcularCarga([], { duracionMin: 30 });
    expect(mallaDeOferta(bloque([]))!.franjas).toEqual(demanda.franjas);
  });

  it("coloca cada franja en su día y su columna, con los nombres del motor", () => {
    const m = mallaDeOferta(bloque([
      { dia: "lunes", franjas: [franja("09:00", "09:30", ["Ana Prueba", "Berta Ficticia"])] },
      { dia: "jueves", franjas: [franja("12:00", "12:30", ["Ana Prueba"])] },
    ]))!;
    const j0900 = m.franjas.indexOf(9 * 60);
    const j1200 = m.franjas.indexOf(12 * 60);
    expect(m.disponibles[0][j0900]).toBe(2);
    expect(m.nombres[0][j0900]).toEqual(["Ana Prueba", "Berta Ficticia"]);
    expect(m.disponibles[3][j1200]).toBe(1);
    // Personas DISTINTAS: Ana está en dos días y cuenta una vez.
    expect(m.aplicadores).toBe(2);
  });

  it("rotula con tilde los días que el motor manda sin ella, en orden de semana", () => {
    // El lector normaliza «miércoles»→«miercoles» (claves sin tilde, B29); la
    // vista devuelve la palabra bien escrita. Y el orden es el de la semana
    // aunque el payload llegue desordenado.
    const m = mallaDeOferta(bloque([
      { dia: "sabado", franjas: [franja("10:00", "10:30", ["Zoe Unica"])] },
      { dia: "miercoles", franjas: [franja("10:00", "10:30", ["Ana Prueba"])] },
    ]))!;
    const j = m.franjas.indexOf(10 * 60);
    expect(m.filas[2].etiqueta).toBe("miércoles");
    expect(m.filas[5].etiqueta).toBe("sábado");
    expect(m.disponibles[2][j]).toBe(1);
    expect(m.disponibles[5][j]).toBe(1);
  });

  it("el domingo solo existe cuando el motor lo trae: la demanda no lo tiene", () => {
    // La malla de demanda es lunes→sábado. Una fila de domingo permanente
    // rompería el espejo; una oferta de domingo ESCONDIDA sería una lista
    // cerrada tragándose datos. Se añade solo cuando llega.
    expect(mallaDeOferta(bloque([]))!.filas).toHaveLength(6);
    const m = mallaDeOferta(bloque([
      { dia: "domingo", franjas: [franja("10:00", "10:30", ["Ana Prueba"])] },
    ]))!;
    expect(m.filas).toHaveLength(7);
    expect(m.filas[6].etiqueta).toBe("domingo");
    expect(m.disponibles[6][m.franjas.indexOf(10 * 60)]).toBe(1);
  });

  it("el pico de oferta es el mejor momento; en empate manda el más temprano", () => {
    const m = mallaDeOferta(bloque([
      { dia: "lunes", franjas: [franja("09:00", "09:30", ["Ana Prueba", "Berta Ficticia"])] },
      { dia: "martes", franjas: [franja("08:00", "08:30", ["Ana Prueba", "Berta Ficticia"])] },
    ]))!;
    expect(m.pico).toEqual({ fila: 0, franja: 9 * 60, disponibles: 2 });
  });

  it("sobrevive a la frontera jsonlite: escalares envueltos y nombre suelto", () => {
    const m = mallaDeOferta(bloque([
      {
        dia: ["lunes"],
        franjas: [{ inicio: ["09:00"], fin: ["09:30"], disponibles: [1], nombres: "Ana Prueba" }],
      },
    ]))!;
    const j = m.franjas.indexOf(9 * 60);
    expect(m.disponibles[0][j]).toBe(1);
    expect(m.nombres[0][j]).toEqual(["Ana Prueba"]);
  });

  it("sin nombres, la cifra del motor manda: la franja no se queda muda", () => {
    const m = mallaDeOferta(bloque([
      { dia: "lunes", franjas: [{ inicio: "09:00", fin: "09:30", disponibles: 3 }] },
    ]))!;
    expect(m.disponibles[0][m.franjas.indexOf(9 * 60)]).toBe(3);
    expect(m.nombres[0][m.franjas.indexOf(9 * 60)]).toEqual([]);
  });

  it("lo que no cae en la malla se declara, no se traga", () => {
    // Una franja antes de las 07:00 o desalineada del paso de 30 no tiene
    // columna. Desaparecer en silencio es la lista cerrada que se come filas.
    const m = mallaDeOferta(bloque([
      {
        dia: "lunes",
        franjas: [
          franja("06:30", "07:00", ["Ana Prueba"]),
          franja("09:15", "09:45", ["Ana Prueba"]),
          franja("09:00", "09:30", ["Ana Prueba"]),
        ],
      },
      { dia: "feriado", franjas: [franja("09:00", "09:30", ["Berta Ficticia"])] },
      { dia: "lunes", franjas: [{ inicio: "no-hora", fin: "09:30", nombres: ["Ana Prueba"] }] },
    ]))!;
    expect(m.disponibles[0][m.franjas.indexOf(9 * 60)]).toBe(1);
    expect(m.fueraDeEje).toBe(2);
    expect(m.ilegibles).toBe(2);
  });
});

describe("columnasVivas", () => {
  it("une las columnas ocupadas de demanda y oferta para que las tres vistas compartan eje", () => {
    // Demanda ocupa la columna 1; la oferta, la 3. Quien conmuta entre las
    // vistas tiene que ver LAS MISMAS columnas, o el vistazo comparado miente.
    const demanda = [[0, 2, 0, 0], [0, 0, 0, 0]];
    const oferta = [[0, 0, 0, 5]];
    expect(columnasVivas(4, [demanda, oferta])).toEqual([1, 3]);
  });

  it("sin ninguna matriz ocupada no hay columnas", () => {
    expect(columnasVivas(3, [[[0, 0, 0]]])).toEqual([]);
    expect(columnasVivas(3, [])).toEqual([]);
  });
});
