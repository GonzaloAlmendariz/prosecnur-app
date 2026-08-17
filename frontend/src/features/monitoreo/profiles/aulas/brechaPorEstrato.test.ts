import { describe, expect, test } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { brechaPorEstrato } from "./brechaPorEstrato";

function fila(estrato: string, validas: number, brecha: number, aulas = 1): MonitoreoRow {
  return { stratum: estrato, respuestas_validas: validas, brecha, aulas };
}

describe("brechaPorEstrato", () => {
  test("ordena por lo que falta, no por lo que ya se hizo", () => {
    // Derecho va MUY adelantado en porcentaje (95 %) y aun asi es el destino de
    // manana: le faltan 200 respuestas. Ciencias esta al 50 % y le faltan 4.
    // Ordenar por avance pondria Ciencias primero y mandaria al equipo al sitio
    // equivocado.
    const { estratos } = brechaPorEstrato([
      fila("Ciencias", 4, 4),
      fila("Derecho", 3800, 200),
      fila("Letras", 100, 50),
    ]);
    expect(estratos.map((e) => e.estrato)).toEqual(["Derecho", "Letras", "Ciencias"]);
  });

  test("a igualdad de brecha adelanta al que mas lleva recogido", () => {
    const { estratos } = brechaPorEstrato([
      fila("Arte", 10, 30),
      fila("Gestion", 300, 30),
    ]);
    expect(estratos[0].estrato).toBe("Gestion");
  });

  test("no recorta en silencio: dice cuantos no dibujo y cuanto suman", () => {
    const muchos = Array.from({ length: 15 }, (_, i) => fila(`F${i}`, 0, 15 - i));
    const res = brechaPorEstrato(muchos, 12);
    expect(res.estratos).toHaveLength(12);
    expect(res.omitidos).toBe(3);
    // Los tres de menor brecha: 3 + 2 + 1.
    expect(res.brechaOmitida).toBe(6);
    expect(res.brechaTotal).toBe(120);
  });

  test("cuenta aparte los estratos ya cerrados", () => {
    const res = brechaPorEstrato([
      fila("Cerrado", 90, 0),
      fila("Abierto", 10, 40),
      fila("Tambien cerrado", 50, 0),
    ]);
    expect(res.cerrados).toBe(2);
    expect(res.total).toBe(3);
  });

  test("descarta la fila sin estrato en vez de dibujar una barra sin nombre", () => {
    const res = brechaPorEstrato([
      { stratum: "", respuestas_validas: 5, brecha: 5 },
      fila("Derecho", 10, 10),
    ]);
    expect(res.total).toBe(1);
    expect(res.estratos[0].estrato).toBe("Derecho");
  });

  test("un valor no numerico cuenta como cero y no como NaN", () => {
    // Sin la coaccion la barra desaparece del grafico sin decir por que, que es
    // peor que dibujarla en cero: el estrato existe y sigue teniendo aulas.
    const res = brechaPorEstrato([
      { stratum: "Derecho", respuestas_validas: null, brecha: "sin dato", aulas: 4 },
    ]);
    expect(res.estratos[0]).toMatchObject({ validas: 0, brecha: 0, aulas: 4 });
    expect(Number.isNaN(res.brechaTotal)).toBe(false);
  });
});
