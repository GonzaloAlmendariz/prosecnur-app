import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { renderToStaticMarkup } from "react-dom/server";

import { AulasAvanceEnRespuestas } from "./AulasAvanceEnRespuestas";
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

/**
 * El banco no entra en el denominador.
 *
 * `extra_reserve_pool` trae `expected_valid` porque es lo que rendiría SI se
 * activara, no lo que el operativo pide hoy. El motor ya lo excluye y esta
 * vista no, así que la misma pantalla enseñaba «meta 4 476» arriba y «la meta
 * de 4 336» dos paneles más abajo. Medido: el banco eran esos 140.
 */
describe("avanceEnRespuestas y el banco", () => {
  const fila = (rol: string, meta: number, validas: number) => ({
    operational_code: `${rol}-${meta}`,
    sample_role: rol,
    expected_valid: meta,
    respuestas_validas: validas,
  } as unknown as MonitoreoAulasPlanRow);

  it("las reservas sueltas no inflan la meta ni la brecha", () => {
    const res = avanceEnRespuestas([
      fila("titular", 100, 40),
      fila("chain_reserve", 30, 10),
      fila("extra_reserve_pool", 140, 0),
    ]);

    // 100 + 30, sin los 140 del banco.
    expect(res.meta).toBe(130);
    // Y su aula no cuenta como una que no llegó a su meta.
    expect(res.aulasConBrecha).toBe(2);
  });
});

/**
 * Sólo el eslabón en juego.
 *
 * Un slot es la cadena entera y en cada momento una sola de sus aulas es a la
 * que hay que ir. Sumar las dormidas cuenta el mismo slot tantas veces como
 * respaldos tenga: el panel pedía 4 336 mientras el ritmo y la cuota decían
 * 3 743 en la misma pantalla.
 */
describe("avanceEnRespuestas y el eslabón en juego", () => {
  const fila = (rol: string, meta: number, enJuego: boolean) => ({
    operational_code: `${rol}-${meta}`,
    sample_role: rol,
    expected_valid: meta,
    respuestas_validas: 0,
    en_juego: enJuego,
  } as unknown as MonitoreoAulasPlanRow);

  it("la reserva dormida no suma a la meta", () => {
    const res = avanceEnRespuestas([
      fila("titular", 100, true),
      fila("chain_reserve", 90, false),
      fila("chain_reserve", 80, false),
    ]);
    expect(res.meta).toBe(100);
  });

  it("cuando la reserva entra, es ella la que cuenta", () => {
    const res = avanceEnRespuestas([
      fila("titular", 100, false),
      fila("chain_reserve", 90, true),
    ]);
    expect(res.meta).toBe(90);
  });

  it("un payload viejo sin el campo cuenta como antes", () => {
    // `en_juego` ausente no puede significar «fuera»: un motor que aún no lo
    // publique dejaría la meta en cero y la pantalla diría que no falta nada.
    const sinCampo = { operational_code: "CH 1", expected_valid: 100, respuestas_validas: 0 };
    expect(avanceEnRespuestas([sinCampo as never]).meta).toBe(100);
  });
});

/**
 * El hueco entre lo recogido y lo atribuido, dicho.
 *
 * Hay estudios donde llegan miles de respuestas y ninguna se puede colgar de un
 * aula —vienen anónimas, sin el enlace que las ata a su curso-horario—. La
 * pantalla enseñaba «3 700 válidas» arriba y «0 de 3 743» abajo, sin nada en
 * medio: se lee como una avería y no lo es.
 */
describe("AulasAvanceEnRespuestas y las respuestas sin atribuir", () => {
  const conMeta = [{
    operational_code: "CH 1", expected_valid: 100, respuestas_validas: 0, en_juego: true,
  } as unknown as MonitoreoAulasPlanRow];

  it("lo dice cuando hay respuestas pero ninguna se atribuye", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceEnRespuestas filas={conMeta} validasTotales={3700} />,
    );
    expect(html).toContain("sin identificar");
    expect(html).toContain("3,700");
  });

  it("se calla cuando sí hay respuestas atribuidas", () => {
    const conRespuestas = [{
      operational_code: "CH 1", expected_valid: 100, respuestas_validas: 40, en_juego: true,
    } as unknown as MonitoreoAulasPlanRow];
    const html = renderToStaticMarkup(
      <AulasAvanceEnRespuestas filas={conRespuestas} validasTotales={3700} />,
    );
    expect(html).not.toContain("sin identificar");
  });

  it("se calla cuando el corte todavía no trae respuestas", () => {
    // Cero y cero no es un hueco: es un estudio que no ha empezado.
    const html = renderToStaticMarkup(
      <AulasAvanceEnRespuestas filas={conMeta} validasTotales={0} />,
    );
    expect(html).not.toContain("sin identificar");
  });
});
