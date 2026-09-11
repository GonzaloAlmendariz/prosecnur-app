import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import {
  aporteDelAula, inventarioDeLaFacultad, planDeRefuerzo, refuerzosDeFacultad,
} from "./refuerzosDeFacultad";

const fila = (extra: Record<string, unknown>): MonitoreoAulasPlanRow =>
  ({
    faculty: "DERECHO", eligible_n: 20, sex_top_1: "F", sex_top_1_n: 12, sex_top_2_n: 8,
    tasa_efectividad_aula: 0.5, sample_role: "chain_reserve",
    operational_status: "planificada", sample_status: "en_reserva", ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

describe("el aporte de un aula", () => {
  it("reparte por sexo y el total es la suma, no un tercer redondeo", () => {
    // 5 mujeres y 24 hombres al 0,52: floor(2,6) + floor(12,48) = 14, no 15.
    const a = aporteDelAula(fila({
      sex_top_1: "M", sex_top_1_n: 24, sex_top_2_n: 5, eligible_n: 29, tasa_efectividad_aula: 0.52,
    }));
    expect(a.mujeres).toBe(2);
    expect(a.hombres).toBe(12);
    expect(a.total).toBe(14);
  });

  it("sin tasa del aula usa la del perfil y no cero", () => {
    const a = aporteDelAula(fila({ tasa_efectividad_aula: 0, sex_top_1_n: 10, sex_top_2_n: 10 }));
    expect(a.tasa).toBeCloseTo(0.55, 3);
    expect(a.total).toBe(10);
  });
});

describe("el inventario de la facultad", () => {
  const plan = [
    // Cadena RESUELTA: su titular se aplicó, así que R1.2 queda al aire.
    fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" }),
    fila({ operational_code: "R 1.1", titular_operational_code: "CH 1", operational_status: "planificada" }),
    fila({ operational_code: "R 1.2", titular_operational_code: "CH 1", operational_status: "planificada" }),
    // Cadena VIVA: nadie salió todavía, sus eslabones siguen comprometidos.
    fila({ operational_code: "CH 2", sample_role: "titular", titular_operational_code: "CH 2", operational_status: "agendada" }),
    fila({ operational_code: "R 2.1", titular_operational_code: "CH 2", operational_status: "planificada" }),
    // Reserva adicional, que nunca entró en cadena.
    fila({ operational_code: "X 1", sample_role: "extra_reserve_pool", titular_operational_code: "" }),
    // Otra facultad: la frontera es dura.
    fila({ operational_code: "X 9", sample_role: "extra_reserve_pool", faculty: "LETRAS" }),
  ];

  it("libera los eslabones de una cadena resuelta y respeta los de una viva", () => {
    const codigos = inventarioDeLaFacultad(plan, "DERECHO").map((x) => String(x.fila.operational_code));
    expect(codigos).toContain("R 1.1");
    expect(codigos).toContain("R 1.2");
    // R 2.1 sigue siendo la red de CH 2, que todavía no salió.
    expect(codigos).not.toContain("R 2.1");
  });

  it("nunca cruza la frontera de la facultad", () => {
    const codigos = inventarioDeLaFacultad(plan, "DERECHO").map((x) => String(x.fila.operational_code));
    expect(codigos).not.toContain("X 9");
    expect(inventarioDeLaFacultad(plan, "LETRAS").map((x) => String(x.fila.operational_code))).toEqual(["X 9"]);
  });

  it("sin facultad no ofrece nada: no se garantiza la frontera", () => {
    expect(inventarioDeLaFacultad(plan, "")).toEqual([]);
  });

  it("distingue de dónde sale cada una", () => {
    const inv = inventarioDeLaFacultad(plan, "DERECHO");
    expect(inv.find((x) => x.fila.operational_code === "X 1")!.procedencia).toBe("extra");
    expect(inv.find((x) => x.fila.operational_code === "R 1.1")!.procedencia).toBe("al_aire");
  });

  it("un titular aplicado no es inventario: ya rindió", () => {
    const codigos = inventarioDeLaFacultad(plan, "DERECHO").map((x) => String(x.fila.operational_code));
    expect(codigos).not.toContain("CH 1");
  });
});

describe("los candidatos a refuerzo se ordenan por lo que CIERRAN, no por lo que rinden", () => {
  /**
   * El caso que mata la versión ingenua: la facultad debe sólo mujeres, y el
   * aula más grande es casi toda de hombres. Ordenar por lo que rinde la pone
   * primera y es justo la que no sirve para la cuota.
   */
  const plan = [
    fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" }),
    // 40 hombres, 2 mujeres, al 0,5 → aporta 20 H y 1 M. Rinde 21.
    fila({ operational_code: "GRANDE", titular_operational_code: "CH 1",
      sex_top_1: "M", sex_top_1_n: 40, sex_top_2_n: 2, eligible_n: 42 }),
    // 16 mujeres, 4 hombres, al 0,5 → aporta 8 M y 2 H. Rinde 10.
    fila({ operational_code: "UTIL", titular_operational_code: "CH 1",
      sex_top_1: "F", sex_top_1_n: 16, sex_top_2_n: 4, eligible_n: 20 }),
  ];

  it("la que cierra la deuda va primera aunque rinda la mitad", () => {
    const c = refuerzosDeFacultad(plan, "DERECHO", { mujeres: 12, hombres: 0 });
    expect(c[0].fila.operational_code).toBe("UTIL");
    expect(c[0].util).toBe(8);
    // La grande aporta 21 respuestas y cierra 1 de las 12 que se deben.
    expect(c[1].aporta.total).toBe(21);
    expect(c[1].util).toBe(1);
  });

  it("lo útil se corta contra lo que se debe de ESE sexo, no contra el total", () => {
    const c = refuerzosDeFacultad(plan, "DERECHO", { mujeres: 3, hombres: 0 });
    const util = c.find((x) => x.fila.operational_code === "UTIL")!;
    // Aporta 8 mujeres pero sólo se deben 3: cierra 3, no 8.
    expect(util.aporta.mujeres).toBe(8);
    expect(util.util).toBe(3);
    expect(util.cierra).toBeCloseTo(1, 3);
    expect(util.quedaria).toEqual({ mujeres: 0, hombres: 0 });
  });

  it("dice lo que quedaría debiendo, que es con lo que se decide si basta", () => {
    const c = refuerzosDeFacultad(plan, "DERECHO", { mujeres: 20, hombres: 5 });
    const util = c.find((x) => x.fila.operational_code === "UTIL")!;
    expect(util.quedaria).toEqual({ mujeres: 12, hombres: 3 });
  });

  it("sin deuda no inventa un orden por cuota: cierra 0 para todos", () => {
    const c = refuerzosDeFacultad(plan, "DERECHO", { mujeres: 0, hombres: 0 });
    expect(c.every((x) => x.cierra === 0)).toBe(true);
    // Y entonces manda lo que rinde, que es lo único que queda.
    expect(c[0].fila.operational_code).toBe("GRANDE");
  });
});

describe("el plan dice si alcanza", () => {
  const plan = [
    fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" }),
    fila({ operational_code: "R A", titular_operational_code: "CH 1", sex_top_1: "F", sex_top_1_n: 20, sex_top_2_n: 0, eligible_n: 20 }),
    fila({ operational_code: "R B", titular_operational_code: "CH 1", sex_top_1: "F", sex_top_1_n: 20, sex_top_2_n: 0, eligible_n: 20 }),
  ];

  it("cuenta cuántas aulas hacen falta tomándolas en orden", () => {
    // Cada una aporta 10 mujeres; se deben 15 → hacen falta dos.
    const c = refuerzosDeFacultad(plan, "DERECHO", { mujeres: 15, hombres: 0 });
    const p = planDeRefuerzo(c, { mujeres: 15, hombres: 0 });
    expect(p.hacenFalta).toBe(2);
    expect(p.alcanza).toBe(true);
  });

  it("cuando no alcanza lo dice, y dice cuánto falta", () => {
    const c = refuerzosDeFacultad(plan, "DERECHO", { mujeres: 40, hombres: 0 });
    const p = planDeRefuerzo(c, { mujeres: 40, hombres: 0 });
    expect(p.alcanza).toBe(false);
    expect(p.restaM).toBe(20);
  });

  it("«no hay deuda» no es lo mismo que «hacen falta 0 aulas»", () => {
    const p = planDeRefuerzo([], { mujeres: 0, hombres: 0 });
    expect(p.sinDeuda).toBe(true);
    expect(p.alcanza).toBe(true);
  });

  it("no gasta un aula que no cierra nada de lo que se debe", () => {
    const soloHombres = [
      fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1", operational_status: "aplicada" }),
      fila({ operational_code: "R H", titular_operational_code: "CH 1", sex_top_1: "M", sex_top_1_n: 20, sex_top_2_n: 0, eligible_n: 20 }),
      fila({ operational_code: "R M", titular_operational_code: "CH 1", sex_top_1: "F", sex_top_1_n: 20, sex_top_2_n: 0, eligible_n: 20 }),
    ];
    const deuda = { mujeres: 8, hombres: 0 };
    const p = planDeRefuerzo(refuerzosDeFacultad(soloHombres, "DERECHO", deuda), deuda);
    // Basta la de mujeres: la de hombres no entra en la cuenta.
    expect(p.hacenFalta).toBe(1);
  });
});

describe("una cadena se resuelve por el HECHO, no por el estado tecleado", () => {
  /**
   * Gonzalo, 2026-09-11, sobre el popover de refuerzo de Ciencias Sociales: «me
   * preocupa este caso, no queda ningún reemplazo disponible».
   *
   * No quedaba ninguno porque el inventario miraba `operational_status`, que
   * nadie había tecleado. Medido en ese momento sobre HSVG26ULT2: por estado,
   * **0 cadenas resueltas y 0 reservas liberadas**; por las respuestas, **61 y
   * 398**. La pantalla mandaba a ampliar el marco a quien ya tenía con qué, que
   * es el error más caro que puede cometer.
   */
  const fila = (extra: Record<string, unknown>): MonitoreoAulasPlanRow =>
    ({
      faculty: "DERECHO", eligible_n: 20, sex_top_1: "F", sex_top_1_n: 12, sex_top_2_n: 8,
      tasa_efectividad_aula: 0.5, sample_role: "chain_reserve",
      operational_status: "planificada", sample_status: "en_reserva", ...extra,
    }) as unknown as MonitoreoAulasPlanRow;

  it("el titular con respuestas libera su cadena aunque siga en «planificada»", () => {
    const plan = [
      fila({ operational_code: "CH 1", sample_role: "titular", titular_operational_code: "CH 1",
        operational_status: "planificada", respuestas_validas: 14 }),
      fila({ operational_code: "R 1.1", titular_operational_code: "CH 1" }),
      fila({ operational_code: "R 1.2", titular_operational_code: "CH 1" }),
    ];
    const codigos = inventarioDeLaFacultad(plan, "DERECHO").map((x) => String(x.fila.operational_code));
    expect(codigos).toEqual(["R 1.1", "R 1.2"]);
  });

  it("sin respuestas y sin estado, la cadena sigue viva y sus reservas atadas", () => {
    // El control: si el arreglo fuera «liberar siempre», este caso fallaría y
    // se gastaría la red de un titular que todavía puede caer.
    const plan = [
      fila({ operational_code: "CH 2", sample_role: "titular", titular_operational_code: "CH 2",
        operational_status: "planificada", respuestas_validas: 0 }),
      fila({ operational_code: "R 2.1", titular_operational_code: "CH 2" }),
    ];
    expect(inventarioDeLaFacultad(plan, "DERECHO")).toEqual([]);
  });

  it("la reserva que ya rindió no vuelve al inventario", () => {
    const plan = [
      fila({ operational_code: "CH 3", sample_role: "titular", titular_operational_code: "CH 3",
        operational_status: "planificada", respuestas_validas: 0 }),
      fila({ operational_code: "R 3.1", titular_operational_code: "CH 3", respuestas_validas: 9 }),
      fila({ operational_code: "R 3.2", titular_operational_code: "CH 3" }),
    ];
    // R 3.1 cubrió el slot con sus respuestas: libera a R 3.2 y ella no vuelve.
    const codigos = inventarioDeLaFacultad(plan, "DERECHO").map((x) => String(x.fila.operational_code));
    expect(codigos).toEqual(["R 3.2"]);
  });
});
