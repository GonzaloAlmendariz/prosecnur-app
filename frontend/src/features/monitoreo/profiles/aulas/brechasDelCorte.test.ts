import { describe, expect, it } from "vitest";

import { brechasDelCorte, repartoDeBrechas } from "./brechasDelCorte";

/**
 * El diagnóstico que separa el complemento (B) del refuerzo (C). «Rindió poco»
 * no significa nada suelto: poco contra lo que su facultad preveía.
 */
const fila = (f: Record<string, unknown>) => f as never;

const plan = [
  // No se aplicó: le falta todo porque no le ha tocado.
  fila({ operational_code: "CH 61", faculty: "LETRAS", eligible_n: 40, respuestas_validas: 0,
         expected_valid: 30, brecha: 30, tasa_facultad: 0.568, application_status: "pendiente" }),
  // Aplicada y muy por debajo de lo que su facultad preveía.
  fila({ operational_code: "CH 23", faculty: "ARTES", eligible_n: 62, respuestas_validas: 20,
         expected_valid: 46, brecha: 26, tasa_facultad: 0.74, application_status: "aplicada",
         sex_top_1: "F", sex_top_1_n: 40, sex_top_2: "M", sex_top_2_n: 22 }),
  // Aplicada y cerca: rinde el 90 % de lo previsto.
  fila({ operational_code: "CH 84", faculty: "DERECHO", eligible_n: 50, respuestas_validas: 26,
         expected_valid: 28, brecha: 2, tasa_facultad: 0.568, application_status: "aplicada" }),
  // Cumplida: no tiene nada que hacer.
  fila({ operational_code: "CH 95", faculty: "DERECHO", eligible_n: 40, respuestas_validas: 30,
         expected_valid: 22, brecha: 0, tasa_facultad: 0.568, application_status: "aplicada" }),
];

describe("las brechas del corte", () => {
  it("separa la que no se aplicó de la que rindió poco", () => {
    // Un aula a la que no se ha ido no ha fallado: su salida es la agenda.
    const b = brechasDelCorte(plan);
    const porCodigo = Object.fromEntries(b.map((x) => [x.codigo, x]));
    expect(porCodigo["CH 61"].severidad).toBe("sin_aplicar");
    expect(porCodigo["CH 61"].accion).toBe("reemplazo");
    expect(porCodigo["CH 23"].severidad).toBe("muy_por_debajo");
    expect(porCodigo["CH 23"].accion).toBe("complemento");
  });

  it("mide contra la tasa prevista de SU facultad, no contra una media", () => {
    // CH 23 rinde 32 % donde Artes preveía 74: menos de la mitad.
    // CH 84 rinde 52 % donde Derecho preveía 56,8: cerca.
    const b = brechasDelCorte(plan);
    const porCodigo = Object.fromEntries(b.map((x) => [x.codigo, x]));
    expect(porCodigo["CH 84"].severidad).toBe("cerca");
    expect(porCodigo["CH 23"].observada).toBeCloseTo(20 / 62, 3);
    expect(porCodigo["CH 23"].prevista).toBe(0.74);
  });

  it("la que ya cumplió no pide nada", () => {
    const cumplida = brechasDelCorte(plan).find((x) => x.codigo === "CH 95")!;
    expect(cumplida.severidad).toBe("cumplida");
    expect(cumplida.accion).toBe("nada");
  });

  it("ordena por lo que hay que atender primero: el bajo rendimiento, no el sin aplicar", () => {
    /**
     * **Contrato cambiado a propósito el 2026-09-10**, no un test que se
     * aflojó. Antes `sin_aplicar` pesaba 0 y encabezaba; ahora cierra la lista.
     *
     * Gonzalo, con la tabla delante: «no entiendo por qué está mostrando los sin
     * campo cuando debería mostrar los aplicados que tienen bajo rendimiento».
     * Un aula sin visitar no tiene rendimiento que juzgar —le falta la meta
     * entera porque no le ha tocado—, así que al ordenar por lo que falta
     * copaba las primeras filas y enterraba el aula que sí se visitó y se quedó
     * corta, que es la única que justifica meter otra aula detrás.
     *
     * El orden de dentro no cambia: lo más grave primero y, a igual severidad,
     * lo que más falta.
     */
    expect(brechasDelCorte(plan).map((x) => x.codigo)).toEqual(["CH 23", "CH 84", "CH 95", "CH 61"]);
    // Y la razón de que CH 61 baje es su severidad, no su cifra.
    expect(brechasDelCorte(plan).at(-1)!.severidad).toBe("sin_aplicar");
  });

  it("trae la composición por sexo: decide si un relevo cerraría lo que falta", () => {
    const ch23 = brechasDelCorte(plan).find((x) => x.codigo === "CH 23")!;
    expect(ch23.mujeres).toBe(40);
    expect(ch23.hombres).toBe(22);
  });

  it("sin tasa prevista no inventa una severidad fina", () => {
    const b = brechasDelCorte([fila({ operational_code: "CH 7", eligible_n: 30,
      respuestas_validas: 5, expected_valid: 20, brecha: 15, application_status: "aplicada" })]);
    expect(b[0].severidad).toBe("por_debajo");
  });

  it("el reparto cuenta lo que hay de cada cosa", () => {
    const r = repartoDeBrechas(brechasDelCorte(plan));
    expect(r.total).toBe(4);
    expect(r.sinAplicar).toBe(1);
    expect(r.muyPorDebajo).toBe(1);
    expect(r.faltanEnTotal).toBe(58);
  });

  it("sin plan devuelve una lista vacía, no se cae", () => {
    expect(brechasDelCorte(null)).toEqual([]);
    expect(repartoDeBrechas([]).total).toBe(0);
  });
});

/**
 * «No entiendo, ¿la CH 3 no hizo nada?» (Gonzalo, 2026-09-11, sobre un «0.0 %»).
 * Sí fue: el parte anotó 15 alumnos en el aula y no salió ni una encuesta
 * válida. Sin esa cifra el cero se lee como que nadie pisó el aula, y volver a
 * aplicar donde hay gente no se parece en nada a agendar donde no se llegó.
 */
describe("el porqué de un cero", () => {
  const conParte = (extra: Record<string, unknown>) => ([{
    operational_code: "CH 3", faculty: "CC. e Ingeniería", sample_role: "titular",
    eligible_n: 29, expected_valid: 15.1, respuestas_validas: 0,
    application_status: "aplicada", ...extra,
  }] as unknown as Parameters<typeof brechasDelCorte>[0]);

  it("publica cuánta gente había en el aula cuando el parte lo anotó", () => {
    const [f] = brechasDelCorte(conParte({ observed_students: 15, scheduled_date: "2026-09-10" }));
    expect(f.enElAula).toBe(15);
    expect(f.efectivas).toBe(0);
  });

  it("distingue «no lo anotó» de «había cero»", () => {
    // Son cosas distintas y la fila sólo puede hablar de la primera.
    expect(brechasDelCorte(conParte({ observed_students: "", scheduled_date: "2026-09-10" }))[0].enElAula).toBeNull();
    expect(brechasDelCorte(conParte({ observed_students: 0, scheduled_date: "2026-09-10" }))[0].enElAula).toBe(0);
  });
});

/**
 * **Un «aplicada» que nada respalda no se cree ni se descarta: se revisa.**
 *
 * Gonzalo, 2026-09-11: «yo no veo que CH 3 se haya aplicado» — y tenía razón,
 * era un duplicado que el coordinador marcó por error y corrigió en el libro al
 * verlo. Ésa es la razón de que esta señal exista: va a volver a pasar.
 */
describe("el parte que se contradice consigo mismo", () => {
  const fila = (extra: Record<string, unknown>) => ([{
    operational_code: "CH 3", faculty: "CC. e Ingeniería", sample_role: "titular",
    eligible_n: 29, expected_valid: 15.1, respuestas_validas: 0,
    application_status: "aplicada", observed_students: 15,
    sample_status: "en_contacto", scheduled_date: "", ...extra,
  }] as unknown as Parameters<typeof brechasDelCorte>[0]);

  it("sin fecha, sin contacto cerrado y sin una encuesta, se marca en conflicto", () => {
    const [f] = brechasDelCorte(fila({}));
    expect(f.parteEnConflicto).toBe(true);
    expect(f.severidad).toBe("parte_en_conflicto");
    // Y NO se le ofrece complemento: proponerlo da el registro por bueno.
    expect(f.accion).toBe("nada");
  });

  it("con encuestas encima no hay conflicto: el campo desmiente al estado", () => {
    // Es el caso de CH 143, que trajo 23 con el contacto sin cerrar. Ahí lo que
    // falta es actualizar la fila, no revisar si se aplicó.
    const [f] = brechasDelCorte(fila({ respuestas_validas: 23, observed_students: 24 }));
    expect(f.parteEnConflicto).toBe(false);
  });

  it("con fecha agendada tampoco: hay un día que respalda el parte", () => {
    expect(brechasDelCorte(fila({ scheduled_date: "2026-09-09" }))[0].parteEnConflicto).toBe(false);
  });

  it("va primero en el orden: es lo que hay que mirar antes de decidir nada", () => {
    const filas = [
      ...(fila({}) as unknown as Record<string, unknown>[]),
      ...(fila({ operational_code: "CH 9", application_status: "aplicada",
                 respuestas_validas: 2, scheduled_date: "2026-09-09" }) as unknown as Record<string, unknown>[]),
    ] as unknown as Parameters<typeof brechasDelCorte>[0];
    expect(brechasDelCorte(filas)[0].codigo).toBe("CH 3");
  });
});
