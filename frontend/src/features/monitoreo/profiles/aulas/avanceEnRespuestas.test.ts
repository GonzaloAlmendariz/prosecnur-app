import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { avanceEnRespuestas } from "./avanceEnRespuestas";

/**
 * Pasarse en un aula no cubre la falta de otra.
 *
 * La banda dice «Válidas 3 700» y la meta del plan son 4 376, así que a ojo el
 * avance parece 85 %. No lo es: 542 de esas respuestas se recogieron en aulas
 * que ya habían llegado a su meta. Lo que de verdad cubre son 3 158 —un 72 %— y
 * faltan 1 218. Es la misma trampa de la cuota, contada aula por aula.
 */

function aula(meta: number, validas: number): MonitoreoAulasPlanRow {
  return { expected_valid: meta, respuestas_validas: validas } as unknown as MonitoreoAulasPlanRow;
}

describe("el avance en respuestas", () => {
  it("el excedente de un aula no cubre la falta de otra", () => {
    // 30 + 30 de meta, 40 + 10 recogidas. Las 50 respuestas parecerían un 83 %,
    // pero 10 sobran donde ya se cumplió y faltan 20 donde no.
    const a = avanceEnRespuestas([aula(30, 40), aula(30, 10)]);
    expect(a.validas).toBe(50);
    expect(a.cubierto).toBe(40);
    expect(a.excedente).toBe(10);
    expect(a.falta).toBe(20);
    expect(a.avance).toBe(66.7);
  });

  it("lo cubierto más lo que falta es exactamente la meta", () => {
    // El aserto que distingue: si `cubierto` contara las válidas crudas, esta
    // suma se pasaría de la meta.
    const a = avanceEnRespuestas([aula(30, 40), aula(30, 10), aula(20, 20)]);
    expect(a.cubierto + a.falta).toBe(a.meta);
  });

  it("cuenta las aulas que aún no llegan, no las respuestas que faltan", () => {
    const a = avanceEnRespuestas([aula(30, 10), aula(30, 30), aula(30, 0)]);
    expect(a.aulasConBrecha).toBe(2);
    expect(a.falta).toBe(50);
  });

  it("un aula sin meta declarada no entra en el denominador", () => {
    // Arrastrarla inflaría la meta con algo que nadie pidió; sus respuestas sí
    // se cuentan como recogidas, que es lo que son.
    const a = avanceEnRespuestas([aula(30, 30), aula(0, 12)]);
    expect(a.meta).toBe(30);
    expect(a.sinMeta).toBe(1);
    expect(a.validas).toBe(42);
    expect(a.avance).toBe(100);
  });

  it("sin metas no inventa un avance", () => {
    const a = avanceEnRespuestas([aula(0, 12)]);
    expect(a.meta).toBe(0);
    expect(a.avance).toBe(0);
  });
});
