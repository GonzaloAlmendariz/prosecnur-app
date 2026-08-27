import { describe, expect, it } from "vitest";

import { perdidaDelControl } from "./perdidaDelControl";

/**
 * La cuarta cifra de «cuántas encuestas hay» —asistentes → enviadas → válidas →
 * efectivas del parte— y la única que no se dibujaba. Medida sobre el campo real
 * de 2025: se pierde el 9-13 % y NO es constante (91 % · 87 % · 88 % por semana).
 */
describe("la pérdida entre lo enviado y lo que cuenta", () => {
  it("suma sobre las aulas que declaran las dos cifras", () => {
    const p = perdidaDelControl([
      { sent_total: 100, valid_total: 91 },
      { sent_total: 50, valid_total: 44 },
    ])!;
    expect(p.aulas).toBe(2);
    expect(p.enviadas).toBe(150);
    expect(p.validas).toBe(135);
    expect(p.pierde).toBe(15);
    expect(Math.round(p.pasa * 100)).toBe(90);
  });

  it("un aula sin revisar NO cuenta como pérdida, y se dice aparte", () => {
    // Enviadas sin válidas significa que nadie la ha mirado. Contarla como
    // pérdida diría que su trabajo se tiró, cuando lo que pasa es que está en
    // cola. Es la misma familia que «el cero del preview no es un conteo».
    const p = perdidaDelControl([
      { sent_total: 100, valid_total: 91 },
      { sent_total: 40 },
    ])!;
    expect(p.aulas).toBe(1);
    expect(p.sinRevisar).toBe(1);
    expect(p.enviadas).toBe(100);
    expect(p.pierde).toBe(9);
  });

  it("sin ninguna aula con las dos cifras devuelve null, no ceros", () => {
    // Ceros dibujarían una banda llena diciendo «pasa el 100 %» sobre un libro
    // que nadie ha llenado.
    expect(perdidaDelControl([{ sent_total: 40 }, {}])).toBeNull();
    expect(perdidaDelControl([])).toBeNull();
  });

  it("nunca da pérdida negativa", () => {
    // Si el libro declarara más válidas que enviadas, un «se pierden −5» se
    // leería como que aparecieron encuestas.
    const p = perdidaDelControl([{ sent_total: 10, valid_total: 12 }])!;
    expect(p.pierde).toBe(0);
  });

  it("tolera las cifras como texto y con coma decimal, que es como llegan del Excel", () => {
    const p = perdidaDelControl([{ sent_total: "100", valid_total: "87,5" }])!;
    expect(p.enviadas).toBe(100);
    expect(p.validas).toBe(87.5);
  });
});
