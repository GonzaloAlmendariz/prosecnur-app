import { describe, expect, it } from "vitest";

import { alcanceDelBanco, tasaDeRespuestaObservada } from "./alcanceDelBanco";

const aula = (sent: number, elig: number) => ({ sent_total: sent, eligible_n: elig });

describe("tasaDeRespuestaObservada", () => {
  it("pondera por elegibles en vez de promediar tasas", () => {
    // Un aula de 40 elegibles con 20 respuestas (50 %) y una de 4 con 4 (100 %).
    // Ponderada: 24/44 = 54,5 %. Promedio de tasas: 75 %, que le da el mismo
    // peso al aula de 4 que a la de 40 y proyecta casi el doble de encuestas.
    const r = tasaDeRespuestaObservada([aula(20, 40), aula(4, 4)])!;
    expect(Math.round(r.tasa * 1000) / 10).toBe(54.5);
    expect(r.aulas).toBe(2);
    expect(r.enviadas).toBe(24);
    expect(r.elegibles).toBe(44);
  });

  it("una fila sin elegibles no entra, y sin ninguna no hay tasa", () => {
    expect(tasaDeRespuestaObservada([aula(10, 0), aula(5, 10)])!.aulas).toBe(1);
    expect(tasaDeRespuestaObservada([aula(10, 0)])).toBeNull();
    expect(tasaDeRespuestaObservada([])).toBeNull();
  });
});

describe("alcanceDelBanco", () => {
  // Tasa exacta del 50 % y dispersión CERO: así la banda no enturbia los
  // asertos de reparto, que es lo que estos casos miden.
  const control = [aula(5, 10), aula(10, 20), aula(20, 40)];

  it("el déficit se suma por facultad y no se compensa entre ellas", () => {
    // Derecho: banco de 100 elegibles rinde 50 y le faltan 10 → le sobra.
    // Letras: sin banco y le faltan 40 → déficit 40.
    // Restando totales: 50 de falta contra 50 que rinde el banco = déficit 0,
    // que es el número más favorable y el que esconde a Letras entera.
    const r = alcanceDelBanco(
      control,
      [{ faculty: "Derecho", elegibles: 100 }],
      new Map([["Derecho", 10], ["Letras", 40]]),
      10,
    )!;
    expect(r.falta).toBe(50);
    expect(r.rinde).toBe(50);
    expect(r.deficit).toBe(40);
    expect(r.deficitSiSeCompensara).toBe(0);
    // Letras aparece aunque no tenga banco: es el peor caso y quedarse fuera
    // por no tener fila sería no contarla.
    expect(r.facultades[0]).toEqual({ facultad: "Letras", elegibles: 0, rinde: 0, falta: 40, deficit: 40 });
  });

  it("ningún alumno del banco es una encuesta", () => {
    // 200 elegibles al 50 % son 100 encuestas, no 200.
    const r = alcanceDelBanco(control, [{ faculty: "A", elegibles: 200 }], new Map([["A", 150]]), 10)!;
    expect(r.rinde).toBe(100);
    expect(r.deficit).toBe(50);
  });

  it("el veredicto se decide en el extremo desfavorable de la banda", () => {
    // Con dispersión, «alcanza» exige que hasta el extremo bajo cubra la falta.
    const dispersas = [aula(2, 10), aula(8, 10), aula(5, 10), aula(9, 10), aula(1, 10)];
    const r = alcanceDelBanco(dispersas, [{ faculty: "A", elegibles: 200 }], new Map([["A", 100]]), 4)!;
    expect(r.bajo).toBeLessThan(r.rinde);
    expect(r.alto).toBeGreaterThan(r.rinde);
    expect(r.veredicto).toBe(r.bajo >= 100 ? "alcanza" : r.alto >= 100 ? "justo" : "no alcanza");
    // El control: sin dispersión el mismo caso sí alcanza, así que el veredicto
    // depende del ruido y no sólo de la cifra central.
    const sinRuido = alcanceDelBanco(control, [{ faculty: "A", elegibles: 200 }], new Map([["A", 100]]), 4)!;
    expect(sinRuido.veredicto).toBe("alcanza");
  });

  it("la banda se estrecha con las aulas que se van a abrir, no con las ya medidas", () => {
    // Abrir 3 aulas es mucho más incierto que abrir 70. Una banda calculada
    // sobre la muestra vieja diría lo contrario: que da igual cuántas se abran.
    const dispersas = [aula(2, 10), aula(8, 10), aula(5, 10), aula(9, 10), aula(1, 10)];
    const pocas = alcanceDelBanco(dispersas, [{ faculty: "A", elegibles: 200 }], new Map([["A", 100]]), 3)!;
    const muchas = alcanceDelBanco(dispersas, [{ faculty: "A", elegibles: 200 }], new Map([["A", 100]]), 70)!;
    expect(pocas.alto - pocas.bajo).toBeGreaterThan(muchas.alto - muchas.bajo);
  });

  it("sin base de control no se proyecta nada", () => {
    expect(alcanceDelBanco([], [{ faculty: "A", elegibles: 10 }], new Map(), 5)).toBeNull();
  });
});
