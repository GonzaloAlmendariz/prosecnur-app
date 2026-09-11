import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { aulasQueSeMetieron, repartoDelAporte } from "./aporteDelAbc";

const fila = (extra: Record<string, unknown>): MonitoreoAulasPlanRow =>
  ({
    faculty: "DERECHO", eligible_n: 20, respuestas_validas: 0,
    tasa_facultad: 0.55, sample_role: "chain_reserve",
    operational_status: "planificada", ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

describe("qué fue cada aula para el plan", () => {
  /**
   * La distinción de Gonzalo: «esa aula no estaba prevista […] son alumnos
   * netos o puros». Se mide por el HECHO —si el titular salió— y no por el
   * verbo del libro, que se teclea al aplicar y llega días tarde.
   */
  it("si el titular también se aplicó, lo que trae la reserva es neto", () => {
    const plan = [
      fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada", respuestas_validas: 12 }),
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", operational_status: "aplicada", respuestas_validas: 9 }),
    ];
    const [r] = aulasQueSeMetieron(plan);
    expect(r.codigo).toBe("R 1.1");
    expect(r.papel).toBe("neta");
  });

  it("si el titular NO salió, la reserva repone: el plan ya contaba con esas respuestas", () => {
    const plan = [
      fila({ operational_code: "CH 2", sample_role: "titular", titular_operational_code: "CH 2", operational_status: "no_aplicada" }),
      fila({ operational_code: "R 2.1", titular_operational_code: "CH 2", operational_status: "aplicada", respuestas_validas: 9 }),
    ];
    expect(aulasQueSeMetieron(plan)[0].papel).toBe("repone");
  });

  it("la reserva adicional nunca tuvo titular al que reponer: siempre neta", () => {
    const plan = [fila({
      operational_code: "X 1", sample_role: "extra_reserve_pool",
      titular_operational_code: "", operational_status: "aplicada", respuestas_validas: 11,
    })];
    const [r] = aulasQueSeMetieron(plan);
    expect(r.papel).toBe("neta");
    expect(r.deLaReserva).toBe(true);
  });

  it("el titular no es lo que se metió: es el plan", () => {
    const plan = [fila({ operational_code: "CH 1", sample_role: "titular", operational_status: "aplicada", respuestas_validas: 12 })];
    expect(aulasQueSeMetieron(plan)).toEqual([]);
  });

  it("una reserva que todavía no rindió no se juzga", () => {
    const plan = [
      fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" }),
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", operational_status: "agendada" }),
    ];
    expect(aulasQueSeMetieron(plan)).toEqual([]);
  });
});

describe("las dos preguntas no son la misma cifra", () => {
  it("lo que rindió se mide contra la prevista de su facultad", () => {
    const plan = [
      fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" }),
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", operational_status: "aplicada",
        respuestas_validas: 6, eligible_n: 20, tasa_facultad: 0.6 }),
    ];
    const [r] = aulasQueSeMetieron(plan);
    expect(r.observada).toBeCloseTo(0.3, 3);
    expect(r.prevista).toBe(0.6);
  });

  it("un complemento mediocre aporta más que un reemplazo impecable", () => {
    // Es la razón de que las dos varas existan: el reemplazo repone lo que el
    // titular caído iba a dar, y ordenar por tasa lo pondría primero.
    const plan = [
      fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" }),
      fila({ operational_code: "B", titular_operational_code: "CH 1", operational_status: "aplicada",
        respuestas_validas: 6, eligible_n: 30 }),
      fila({ operational_code: "CH 2", sample_role: "titular", titular_operational_code: "CH 2", operational_status: "no_aplicada" }),
      fila({ operational_code: "A", titular_operational_code: "CH 2", operational_status: "aplicada",
        respuestas_validas: 18, eligible_n: 20 }),
    ];
    const r = aulasQueSeMetieron(plan);
    // La A rinde 90 % y la B 20 %, y aun así la B va primera: suma.
    expect(r[0].codigo).toBe("B");
    expect(r[0].papel).toBe("neta");
    expect(r[1].codigo).toBe("A");
    const t = repartoDelAporte(r);
    expect(t.ganancia).toBe(6);
    expect(t.repuesto).toBe(18);
  });
});

describe("el reparto por sexo se declara sólo si está completo", () => {
  const conSexo = (codigo: string, m: number, h: number) => fila({
    operational_code: codigo, titular_operational_code: "CH 1", operational_status: "aplicada",
    respuestas_validas: m + h, validas_mujeres: m, validas_hombres: h,
  });
  const titular = fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" });

  it("suma las dos cifras cuando todas las que aportan lo traen", () => {
    const t = repartoDelAporte(aulasQueSeMetieron([titular, conSexo("R 1.1", 5, 4), conSexo("R 1.2", 3, 2)]));
    expect(t.gananciaPorSexo).toEqual({ mujeres: 8, hombres: 6 });
    expect(t.sinSexo).toBe(0);
  });

  it("con una sola sin reparto NO publica el total por sexo", () => {
    // «Trajo 8 mujeres» sobre la mitad de las aulas, presentado como si fuera
    // sobre todas, es una cifra falsa. Se calla y se dice cuántas faltan.
    const sinSexo = fila({ operational_code: "R 1.3", titular_operational_code: "CH 1",
      operational_status: "aplicada", respuestas_validas: 7 });
    const t = repartoDelAporte(aulasQueSeMetieron([titular, conSexo("R 1.1", 5, 4), sinSexo]));
    expect(t.gananciaPorSexo).toBeNull();
    expect(t.sinSexo).toBe(1);
    // El total sin sexo sí se publica: eso sí se sabe.
    expect(t.ganancia).toBe(16);
  });

  it("un cero declarado NO es lo mismo que no saberlo", () => {
    const t = repartoDelAporte(aulasQueSeMetieron([titular, conSexo("R 1.1", 0, 9)]));
    expect(t.gananciaPorSexo).toEqual({ mujeres: 0, hombres: 9 });
  });
});
