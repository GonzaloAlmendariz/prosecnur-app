// mapaDeHoras.test.ts — el modelo de vista del «Mapa de horas» (dictado de
// Gonzalo 2026-09-01: «que el gráfico de la separación de tiempo… se vea
// mejor»).
//
// El backend ya publica el bloque `franjas` en el dashboard de aulas
// (monitoreo_aulas_franjas.R, contrato en test-monitoreo-aulas-franjas.R):
// por fecha agendada, las ventanas dibujables de veinte minutos, el pico de
// carga simultánea contado por RANGO real y los códigos por confirmar. Este
// helper lo convierte en geometría dibujable —eje horario, posiciones en
// porcentaje, marcas— sin recalcular ninguna regla del motor: las horas ya
// vienen parseadas («18:45»), el pico ya viene contado.
//
// El PICO es el porqué de la superficie (C5): «N aulas a la vez · 19:00–19:05»
// es el número de aplicadores que el operativo necesita.
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasFranjas } from "../../../../api/monitoreo";
import { mapaDeHoras } from "./mapaDeHoras";

const v = (codigo: string, inicio: string, fin: string, confirmada = true) => ({
  codigo, inicio, fin, confirmada,
});

const dia = (
  fecha: string,
  ventanas: ReturnType<typeof v>[],
  pico: { aulas: number; inicio?: string; fin?: string } = { aulas: 0 },
  por_confirmar: string[] = [],
) => ({ fecha, ventanas, pico, por_confirmar });

const bloque = (dias: ReturnType<typeof dia>[]): MonitoreoAulasFranjas =>
  ({ dias, personas_fuente: "confirmadas" } as MonitoreoAulasFranjas);

describe("mapaDeHoras declara cuando no hay bloque que dibujar", () => {
  it("sin `franjas` en el payload —backend viejo— dice no disponible, no revienta", () => {
    expect(mapaDeHoras(undefined)).toEqual({ disponible: false });
    expect(mapaDeHoras(null)).toEqual({ disponible: false });
  });

  it("con bloque y cero días es un mapa vacío declarado, no una ausencia", () => {
    const m = mapaDeHoras(bloque([]));
    if (!m.disponible) throw new Error("el bloque existe: el mapa está disponible");
    expect(m.dias).toEqual([]);
    expect(m.picoMaximo).toBeNull();
  });
});

describe("el eje horario de cada día nace de sus ventanas", () => {
  const m = mapaDeHoras(bloque([
    dia(
      "2026-09-08",
      [v("CH 1", "18:45", "19:05"), v("CH 2", "19:00", "19:20")],
      { aulas: 2, inicio: "19:00", fin: "19:05" },
    ),
  ]));
  if (!m.disponible) throw new Error("bloque presente");
  const d = m.dias[0];

  it("margen de diez minutos y redondeo a la media hora, con marcas legibles", () => {
    // Ventanas 18:45–19:20 → eje 18:30–19:30. En una hora de eje, marcas cada
    // media hora: quien mira sabe QUÉ hora es cada punto sin leer tooltips.
    expect(d.marcas.map((x) => x.etiqueta)).toEqual(["18:30", "19:00", "19:30"]);
    expect(d.marcas.map((x) => x.posPct)).toEqual([0, 50, 100]);
  });

  it("cada ventana se posiciona en porcentaje del eje de SU día", () => {
    const ch1 = d.ventanas.find((x) => x.codigo === "CH 1");
    expect(ch1).toMatchObject({ inicio: "18:45", fin: "19:05", confirmada: true });
    expect(ch1?.desdePct).toBe(25);
    expect(ch1?.anchoPct).toBe(33.33);
    const ch2 = d.ventanas.find((x) => x.codigo === "CH 2");
    expect(ch2?.desdePct).toBe(50);
  });

  it("el pico viaja con su franja, también en porcentaje", () => {
    expect(d.picoAulas).toBe(2);
    expect(d.pico).toMatchObject({ inicio: "19:00", fin: "19:05" });
    expect(d.pico?.desdePct).toBe(50);
    expect(d.pico?.anchoPct).toBe(8.33);
  });

  it("la etiqueta del día es la de la casa: «Martes 08/09»", () => {
    expect(d.etiqueta).toBe("Martes 08/09");
  });
});

describe("la ventana tentativa cuenta en el dibujo pero no manda en el pico", () => {
  it("estira el eje y llega marcada como no confirmada", () => {
    // La franja del curso (17:00–20:00, sin hora pactada) es real para el eje:
    // recortarla dejaría la cita confirmada flotando en un eje mentiroso.
    const m = mapaDeHoras(bloque([
      dia(
        "2026-09-08",
        [v("CH 1", "18:45", "19:05"), v("CH 2", "17:00", "20:00", false)],
        { aulas: 1, inicio: "18:45", fin: "19:05" },
        ["CH 2"],
      ),
    ]));
    if (!m.disponible) throw new Error("bloque presente");
    const d = m.dias[0];
    // Eje 16:30–20:30 (margen + media hora); cuatro horas → marcas por hora.
    expect(d.marcas.map((x) => x.etiqueta)).toEqual(["17:00", "18:00", "19:00", "20:00"]);
    const tentativa = d.ventanas.find((x) => x.codigo === "CH 2");
    expect(tentativa?.confirmada).toBe(false);
    expect(tentativa?.desdePct).toBe(12.5);
    expect(tentativa?.anchoPct).toBe(75);
    // Y el día declara sus pendientes tal como el motor los contó.
    expect(d.porConfirmar).toEqual(["CH 2"]);
  });
});

describe("los vacíos y los datos rotos degradan declarando", () => {
  it("pico en cero: el número se dice y la banda no se inventa", () => {
    const m = mapaDeHoras(bloque([
      dia("2026-09-08", [v("CH 2", "17:00", "20:00", false)], { aulas: 0 }, ["CH 2"]),
    ]));
    if (!m.disponible) throw new Error("bloque presente");
    expect(m.dias[0].picoAulas).toBe(0);
    expect(m.dias[0].pico).toBeNull();
    expect(m.picoMaximo).toBeNull();
  });

  it("una hora ilegible no se dibuja ni desaparece: se cuenta", () => {
    // El balde de lo que no se pudo dibujar, para que la superficie lo declare
    // en vez de que un aula se esfume del mapa en silencio.
    const m = mapaDeHoras(bloque([
      dia("2026-09-08", [
        v("CH 1", "18:45", "19:05"),
        v("CH 9", "", "19:05"),
        v("CH 8", "19:05", "19:05"),
        v("CH 7", "25:00", "26:00"),
      ], { aulas: 1, inicio: "18:45", fin: "19:05" }),
    ]));
    if (!m.disponible) throw new Error("bloque presente");
    expect(m.dias[0].ventanas.map((x) => x.codigo)).toEqual(["CH 1"]);
    expect(m.dias[0].ilegibles).toBe(3);
  });

  it("un día con cita sin pactar y nada dibujable conserva su repisa", () => {
    const m = mapaDeHoras(bloque([dia("2026-09-08", [], { aulas: 0 }, ["CH 3"])]));
    if (!m.disponible) throw new Error("bloque presente");
    const d = m.dias[0];
    expect(d.ventanas).toEqual([]);
    expect(d.marcas).toEqual([]);
    expect(d.porConfirmar).toEqual(["CH 3"]);
  });
});

describe("el orden y el pico del operativo", () => {
  it("los días salen en orden de fecha aunque el payload venga desordenado", () => {
    const m = mapaDeHoras(bloque([
      dia("2026-09-10", [v("CH 2", "10:00", "10:20")], { aulas: 1, inicio: "10:00", fin: "10:20" }),
      dia("2026-09-08", [v("CH 1", "18:45", "19:05")], { aulas: 1, inicio: "18:45", fin: "19:05" }),
    ]));
    if (!m.disponible) throw new Error("bloque presente");
    expect(m.dias.map((d) => d.fecha)).toEqual(["2026-09-08", "2026-09-10"]);
  });

  it("picoMaximo es el mayor pico del operativo; en empate, el día más temprano", () => {
    const m = mapaDeHoras(bloque([
      dia("2026-09-10", [v("CH 2", "10:00", "10:20")], { aulas: 3, inicio: "10:00", fin: "10:05" }),
      dia("2026-09-08", [v("CH 1", "18:45", "19:05")], { aulas: 2, inicio: "18:45", fin: "19:05" }),
    ]));
    if (!m.disponible) throw new Error("bloque presente");
    expect(m.picoMaximo).toMatchObject({ aulas: 3, fecha: "2026-09-10", inicio: "10:00", fin: "10:05" });

    const empate = mapaDeHoras(bloque([
      dia("2026-09-10", [v("CH 2", "10:00", "10:20")], { aulas: 2, inicio: "10:00", fin: "10:05" }),
      dia("2026-09-08", [v("CH 1", "18:45", "19:05")], { aulas: 2, inicio: "18:45", fin: "19:05" }),
    ]));
    if (!empate.disponible) throw new Error("bloque presente");
    expect(empate.picoMaximo?.fecha).toBe("2026-09-08");
  });

  it("de dónde salen las personas del pico se conserva, no se afirma de oficio", () => {
    const m = mapaDeHoras(bloque([]));
    if (!m.disponible) throw new Error("bloque presente");
    expect(m.personasFuente).toBe("confirmadas");
  });
});

describe("la frontera jsonlite no rompe el mapa", () => {
  it("escalares envueltos en arrays de uno se leen igual", () => {
    // El payload viaja por jsonlite; el serializador des-encaja, pero este
    // normalizador es defensivo por el mismo motivo que tiemposDeRespuesta.
    const crudo = {
      dias: [{
        fecha: ["2026-09-08"],
        ventanas: [{ codigo: ["CH 1"], inicio: ["18:45"], fin: ["19:05"], confirmada: [true] }],
        pico: { aulas: [2], inicio: ["18:45"], fin: ["19:05"] },
        por_confirmar: ["CH 2"],
      }],
      personas_fuente: ["confirmadas"],
    } as unknown as MonitoreoAulasFranjas;
    const m = mapaDeHoras(crudo);
    if (!m.disponible) throw new Error("bloque presente");
    expect(m.dias[0].ventanas[0]).toMatchObject({ codigo: "CH 1", inicio: "18:45", confirmada: true });
    expect(m.dias[0].picoAulas).toBe(2);
    expect(m.dias[0].porConfirmar).toEqual(["CH 2"]);
    expect(m.personasFuente).toBe("confirmadas");
  });
});
