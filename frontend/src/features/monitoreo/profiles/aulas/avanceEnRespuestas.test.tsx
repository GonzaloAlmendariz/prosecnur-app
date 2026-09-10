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

describe("el puente entre esta cuenta y el KPI de válidas", () => {
  // La banda decía «VÁLIDAS 2,220» y este panel «2,163 cubren meta»: 57 de
  // diferencia a dos centímetros y nada que las uniera. No es un error de suma
  // —el motor cuenta aquí sólo el eslabón EN JUEGO de cada cadena, porque sumar
  // el titular caído y su reserva inflaría una meta dimensionada para un aula—
  // pero sin decirlo son dos cifras del mismo hecho contradiciéndose.
  const resumen = { meta: 100, validas: 80, cubierto: 80, excedente: 0, falta: 20,
    aulas_con_brecha: 2, sin_meta: 0 };

  it("nombra las respuestas que quedan fuera de la cuenta", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceEnRespuestas filas={[]} resumen={resumen as never} validasTotales={95} />,
    );
    expect(html).toContain("15");
    expect(html).toMatch(/eslabones que ya\s*no son el que cuenta/);
  });

  it("no dice nada cuando no hay diferencia que explicar", () => {
    const html = renderToStaticMarkup(
      <AulasAvanceEnRespuestas filas={[]} resumen={resumen as never} validasTotales={80} />,
    );
    expect(html).not.toMatch(/eslabones que ya/);
  });

  it("tampoco cuando el KPI trae menos que la cuenta, que seria otro defecto", () => {
    // Aqui la frase mentiria: `validasTotales` es el total y no puede ser menor.
    // Si lo fuera, restar daria un negativo pintado como si faltaran respuestas.
    const html = renderToStaticMarkup(
      <AulasAvanceEnRespuestas filas={[]} resumen={resumen as never} validasTotales={70} />,
    );
    expect(html).not.toMatch(/eslabones que ya/);
    expect(html).not.toContain("-10");
  });

  /**
   * Sin decimales sobre personas — A9-B6 (2026-08-31).
   *
   * Visto en pantalla: «1 306,3 cubren meta» y «504,7 de más». El cálculo
   * local ya redondea por aula, pero el RESUMEN del motor entra crudo al
   * render y `fmt()` conserva los decimales que trae. Regla congelada: lo
   * CONSEGUIDO hacia ABAJO (no se declara cubierto lo que no se consiguió),
   * lo que FALTA hacia ARRIBA (`fmtCuenta` ya lo hace), y las tasas conservan
   * su decimal.
   */
  describe("el resumen del motor no derrama decimales sobre las personas", () => {
    // El mismo formateador que usa `fmt()`: derivar el esperado de aquí hace al
    // aserto inmune al runner sin ICU completo, que degrada es-PE a separadores
    // ingleses — se afirma el número, no el separador.
    const nf = new Intl.NumberFormat("es-PE");
    const resumen = {
      meta: 3157.8, validas: 1811, cubierto: 1306.3, excedente: 504.7,
      falta: 1851.5, aulas_con_brecha: 92, sin_meta: 0,
    };
    const html = () => renderToStaticMarkup(
      <AulasAvanceEnRespuestas filas={[]} resumen={resumen as never} validasTotales={0} />,
    );

    it("lo cubierto se pinta hacia abajo: 1 306,3 son 1 306", () => {
      const h = html();
      // La frase cambió el 2026-09-10 para decir su unidad —«respuestas cuentan
      // para la meta de su curso-horario»—, porque «cubren meta» se leía como
      // cursos-horario en un panel que se llamaba «Cumplimiento aula por aula».
      // Lo protegido sigue siendo el redondeo, no la redacción.
      expect(h).toContain(`<strong>${nf.format(1306)}</strong> respuestas cuentan`);
      expect(h).not.toContain(`<strong>${nf.format(1306.3)}</strong> respuestas cuentan`);
    });

    it("el titular dice el mismo cubierto entero, no un techo", () => {
      // `fmtCuenta` redondea hacia arriba —regla de una META—, pero `cubierto`
      // es lo CONSEGUIDO: pintar 1 307 declara cubierta una respuesta que no
      // existe, y contradice al «1 306 cubren meta» de dos líneas más abajo.
      // La meta 3 157,8 sí va al entero (3 158).
      expect(html()).toContain(
        `<strong>${nf.format(1306)}</strong> de <strong>${nf.format(3158)}</strong>`,
      );
    });

    it("el excedente también va hacia abajo: 504,7 de más son 504", () => {
      const h = html();
      expect(h).toContain(`<strong>${nf.format(504)}</strong> se recogieron de más`);
      expect(h).not.toContain(`<strong>${nf.format(504.7)}</strong> se recogieron de más`);
    });

    it("lo que falta conserva su techo: 1 851,5 faltan son 1 852", () => {
      // Pin de conservación (hoy verde): con 1 851 no se cierra la falta.
      expect(html()).toContain(`<strong>${nf.format(1852)}</strong> faltan`);
    });

    it("la tasa conserva su decimal: el % de avance no es un conteo", () => {
      // Pin de conservación (hoy verde). 1306,3/3157,8 y 1306/3158 redondean
      // igual, así que el aserto sobrevive al arreglo pinte donde pinte.
      expect(html()).toContain("41.4%");
    });
  });

  describe("las personas se cuentan enteras", () => {
    const f = (x: Record<string, unknown>) => x as never;

    it("una meta fraccionaria no derrama decimales sobre las personas", () => {
      // El caso medido en pantalla: «1 306,3 cubren meta» y «504,7 de más».
      // `expected_valid` es `eligible_n × rendimiento × factor`, así que llega
      // con decimales, y capar un conteo entero contra una fracción los
      // arrastraba.
      const a = avanceEnRespuestas([
        f({ expected_valid: 18.2, respuestas_validas: 12 }),
        f({ expected_valid: 18.2, respuestas_validas: 25 }),
      ]);
      for (const v of [a.meta, a.cubierto, a.excedente, a.falta]) {
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it("redondea la meta hacia ARRIBA: con 18 no se cumple una de 18,2", () => {
      const a = avanceEnRespuestas([f({ expected_valid: 18.2, respuestas_validas: 18 })]);
      expect(a.meta).toBe(19);
      expect(a.cubierto).toBe(18);
      expect(a.falta).toBe(1);
    });

    it("cubierto y excedente siguen sumando las válidas", () => {
      // Es lo que se rompería redondeando sólo al pintar: dos cifras de la misma
      // banda que no cuadran con la tercera.
      const a = avanceEnRespuestas([
        f({ expected_valid: 18.2, respuestas_validas: 25 }),
        f({ expected_valid: 7.5, respuestas_validas: 3 }),
        f({ expected_valid: 12.9, respuestas_validas: 13 }),
      ]);
      expect(a.cubierto + a.excedente).toBe(a.validas);
    });

    it("una meta de cero sigue siendo «sin meta», no una de uno", () => {
      // `Math.ceil(0)` es 0, así que el descarte por meta no declarada no cambia.
      const a = avanceEnRespuestas([f({ expected_valid: 0, respuestas_validas: 4 })]);
      expect(a.sinMeta).toBe(1);
      expect(a.meta).toBe(0);
      expect(a.validas).toBe(4);
    });
  });
});
