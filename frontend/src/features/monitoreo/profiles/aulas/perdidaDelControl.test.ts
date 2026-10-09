import { describe, expect, it } from "vitest";

import { perdidaDelControl } from "./perdidaDelControl";

/**
 * La banda de pérdida del Control compara lo que la hoja da por ENVIADO
 * (`sent_total`, la cuenta del equipo en su Excel) contra la efectiva de
 * PLATAFORMA que la app escribe en la MISMA hoja (`efectivas_obtenidas`).
 * Ésa es la pérdida honesta dentro de la Base de control.
 *
 * `valid_total` NO entra aquí: es un veredicto en todo el resto del repo.
 * `carga_base_control.R` lo declara `solo_lectura` y no lo numeriza —llega
 * «SI», «NO CUMPLE» o una bandera 0/1 del 70 %—, `aulasPresentation` lo rotula
 * «Válido total» y `fichaDeAula` lo lee como veredicto. Sumarlo como conteo
 * producía «De 4.000 enviadas cuentan 120 (3 % pasa)» sobre un libro con
 * banderas, y con «SI»/«NO» mandaba la hoja entera a «sin revisar» — a dos
 * líneas de la columna que pinta ese mismo campo como marca de sí/no.
 * Checklist A20 · censo de las cuatro cifras 2026-09-01, choque 1.
 */
describe("la pérdida entre lo enviado y la efectiva de plataforma", () => {
  it("compara las filas que declaran las dos cifras de la misma hoja", () => {
    const p = perdidaDelControl([
      { sent_total: 100, efectivas_obtenidas: 91 },
      { sent_total: 50, efectivas_obtenidas: 44 },
    ]);
    expect(p).not.toBeNull();
    expect(p!.aulas).toBe(2);
    expect(p!.enviadas).toBe(150);
    expect(p!.validas).toBe(135);
    expect(p!.pierde).toBe(15);
    expect(Math.round(p!.pasa * 100)).toBe(90);
  });

  it("una bandera 0/1 en `valid_total` es un veredicto, no un conteo que sumar", () => {
    // Como la escribe el sembrador de QA: 1 si el aula llegó al 70 %, 0 si no.
    // Leerla como cifra daba «de 770 enviadas cuentan 2 · se pierden 768», la
    // cifra absurda del censo. Lo que cuenta es la efectiva de plataforma que
    // viaja en la misma fila.
    const p = perdidaDelControl([
      { sent_total: 300, valid_total: 1, efectivas_obtenidas: 271 },
      { sent_total: 250, valid_total: 0, efectivas_obtenidas: 224 },
      { sent_total: 220, valid_total: 1, efectivas_obtenidas: 205 },
    ]);
    expect(p).not.toBeNull();
    expect(p!.enviadas).toBe(770);
    expect(p!.validas).toBe(700);
    expect(p!.pierde).toBe(70);
    expect(Math.round(p!.pasa * 100)).toBe(91);
  });

  it("una bandera sola, sin efectiva de plataforma, no habilita la banda", () => {
    // El caso que hacía daño: el veredicto lleno y las columnas de efectivas
    // aún vacías. La lectura vieja devolvía {enviadas: 40, validas: 1} y la
    // banda dibujaba una pérdida fabricada del veredicto.
    expect(perdidaDelControl([{ sent_total: 40, valid_total: 1 }])).toBeNull();
  });

  it("con «SI»/«NO» textual en el veredicto la hoja no se declara sin revisar", () => {
    // `.mac_verdict` acepta SI/NO/CUMPLE/NO CUMPLE: así llega el campo cuando
    // el equipo lo escribe a mano. La lectura vieja hacía parseFloat("SI") →
    // null y mandaba TODAS las filas a `sinRevisar`: banda apagada sobre una
    // hoja llena.
    const p = perdidaDelControl([
      { sent_total: 100, valid_total: "SI", efectivas_obtenidas: 91 },
      { sent_total: 50, valid_total: "NO", efectivas_obtenidas: 44 },
    ]);
    expect(p).not.toBeNull();
    expect(p!.aulas).toBe(2);
    expect(p!.sinRevisar).toBe(0);
    expect(p!.enviadas).toBe(150);
    expect(p!.validas).toBe(135);
  });

  it("2 009 enviadas y 1 811 efectivas: se pierden 198 y pasa el 90 %", () => {
    // La evidencia histórica del checklist («de 2 009 enviadas cuentan 1 811»)
    // sólo se reproduce leyendo `efectivas_obtenidas`: ningún productor real de
    // `valid_total` escribe 1 811.
    const p = perdidaDelControl([
      { sent_total: 2009, efectivas_obtenidas: 1811, valid_total: "CUMPLE" },
    ]);
    expect(p).not.toBeNull();
    expect(p!.enviadas).toBe(2009);
    expect(p!.validas).toBe(1811);
    expect(p!.pierde).toBe(198);
    expect(Math.round(p!.pasa * 100)).toBe(90);
  });

  it("una fila sin efectiva de plataforma queda fuera y se cuenta aparte", () => {
    // Enviadas sin efectivas todavía no se puede comparar; fabricarle pérdida
    // diría que su trabajo se tiró. Sale del cómputo y el resultado declara
    // cuántas quedaron fuera, para que la banda diga cuántas comparó.
    const p = perdidaDelControl([
      { sent_total: 100, efectivas_obtenidas: 91 },
      { sent_total: 40 },
    ]);
    expect(p).not.toBeNull();
    expect(p!.aulas).toBe(1);
    expect(p!.sinRevisar).toBe(1);
    expect(p!.enviadas).toBe(100);
    expect(p!.pierde).toBe(9);
  });

  it("sin ninguna fila comparable devuelve null, no ceros", () => {
    // Ceros dibujarían una banda llena diciendo «pasa el 100 %» sobre un libro
    // que nadie ha llenado.
    expect(perdidaDelControl([{ sent_total: 40 }, {}])).toBeNull();
    expect(perdidaDelControl([])).toBeNull();
  });

  it("nunca da pérdida negativa", () => {
    // Si la hoja declara menos enviadas que efectivas llegaron, un «se pierden
    // −5» se leería como que aparecieron encuestas.
    const p = perdidaDelControl([{ sent_total: 10, efectivas_obtenidas: 12 }]);
    expect(p!.pierde).toBe(0);
  });

  it("tolera las cifras como texto, que es como vuelven del Excel", () => {
    // `efectivas_obtenidas` la escribe la app pero NO está en `.cbc_numericos`
    // (`carga_base_control.R`): al releer el libro llega como texto, igual que
    // cualquier celda que el equipo tocó.
    const p = perdidaDelControl([{ sent_total: "100", efectivas_obtenidas: "91" }]);
    expect(p!.enviadas).toBe(100);
    expect(p!.validas).toBe(91);
  });
});
