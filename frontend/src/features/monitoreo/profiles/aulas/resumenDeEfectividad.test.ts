import { describe, expect, it } from "vitest";
import {
  filaDeLaFacultad, lecturaDeEfectividad, proyeccionDeLaFacultad,
  repartoDeSenales, riesgoDeCierre,
} from "./resumenDeEfectividad";
import type {
  MonitoreoAulasEfectividadFacultad, MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";

/** Las cifras reales del corte del 2026-09-10 sobre HSVG26ULT2. */
const bloque = {
  total: {
    tau_previsto: 0.5135, tau_observado: 0.5812,
    banda_bajo: 0.5215, banda_alto: 0.6409,
    aulas_aplicadas: 56, elegibles_aplicados: 1829, efectivas: 1063,
    facultades_bajo_su_tau: 0, facultades_en_riesgo: 0, alumnos_en_riesgo: 0,
  },
  facultades: [],
} as unknown as MonitoreoAulasEfectividadSeguimiento;

const derecho = {
  facultad: "DERECHO", faculty_key: "derecho",
  tau_previsto: 0.5683, tau_observado: 0.5726,
  banda_bajo: 0.3498, banda_alto: 0.7954,
  aulas_aplicadas: 3, elegibles_aplicados: 124, efectivas: 71,
  senal: "conforme", riesgo: "ajustado",
  cuota: 363, conseguido: 71,
  proyectado: 498.7, proyectado_pesimista: 332.3, proyectado_optimista: 665.1,
} as unknown as MonitoreoAulasEfectividadFacultad;

describe("lecturaDeEfectividad", () => {
  it("resume la COMPARACIÓN, no la tasa suelta", () => {
    const l = lecturaDeEfectividad(bloque)!;
    expect(l.frase).toBe("El diseño supuso 51.4 % y el campo está dando 58.1 %: 6.7 puntos por encima.");
    expect(l.tono).toBe("sobre");
    // **6,7 y no 6,77: la resta se hace sobre las cifras MOSTRADAS.** Es la
    // misma regla con la que el ritmo saca su faltante de la meta que enseña —
    // quien lee 58,1 y 51,4 tiene que poder restar y llegar al número del pie.
    expect(l.puntos).toBe(6.7);
  });

  it("publica de dónde sale la observada", () => {
    const l = lecturaDeEfectividad(bloque)!;
    expect([l.aulas, l.elegibles, l.efectivas]).toEqual([56, 1829, 1063]);
  });

  it("con una facultad manda SU señal, que el motor calcula con la banda", () => {
    // El punto está 0,4 puntos por encima; con tres aulas aplicadas eso es
    // ruido, y el motor lo declara «conforme». Leerlo del signo diría «sobre».
    const l = lecturaDeEfectividad(bloque, derecho)!;
    expect(l.tono).toBe("conforme");
    expect(l.frase).toContain("lo previsto, dentro de la banda");
  });

  it("una facultad sin cursos-horario aplicados NO se da por conforme", () => {
    const sinCampo = { ...derecho, aulas_aplicadas: 0, tau_observado: null, senal: "sin_previsto" } as unknown as MonitoreoAulasEfectividadFacultad;
    const l = lecturaDeEfectividad(bloque, sinCampo)!;
    expect(l.frase).toContain("Todavía no se ha aplicado ningún curso-horario");
    expect(l.tono).toBe("");
  });

  it("sin tasa prevista lo dice en vez de comparar contra nada", () => {
    const sinTau = { ...derecho, tau_previsto: null, senal: "sin_previsto" } as unknown as MonitoreoAulasEfectividadFacultad;
    expect(lecturaDeEfectividad(bloque, sinTau)!.frase).toContain("no dejó una tasa prevista");
  });

  it("sin bloque no devuelve una lectura vacía: devuelve null", () => {
    expect(lecturaDeEfectividad(null)).toBeNull();
  });
});

describe("riesgoDeCierre", () => {
  it("con todas cerrando lo dice sin adornos", () => {
    expect(riesgoDeCierre(bloque)!.frase).toBe("Con lo agendado, todas las facultades cierran su cuota.");
  });

  it("rendir bajo su tasa y no cerrar la cuota son DOS cosas", () => {
    const b = { total: { ...bloque.total, facultades_bajo_su_tau: 4, facultades_en_riesgo: 0 } } as unknown as MonitoreoAulasEfectividadSeguimiento;
    const r = riesgoDeCierre(b)!;
    expect(r.frase).toContain("todas las facultades cierran su cuota");
    expect(r.frase).toContain("4 rinden por debajo");
    expect(r.facultadesEnRiesgo).toBe(0);
  });

  /**
   * **La frase manda la cifra de lo AGENDADO.** Gonzalo, 2026-09-11: «es lo que
   * más importa siempre, porque es lo que tenemos». La del plan entero entra
   * como matiz, porque separa dos acciones distintas: agendar lo que queda, o
   * activar reservas.
   */
  it("el número que decide es el de las que no cierran CON LO AGENDADO", () => {
    const b = { total: {
      ...bloque.total, facultades_en_riesgo: 0, alumnos_en_riesgo: 0,
      facultades_en_riesgo_agendado: 2, alumnos_en_riesgo_agendado: 170,
    } } as unknown as MonitoreoAulasEfectividadSeguimiento;
    const r = riesgoDeCierre(b)!;
    expect(r.frase).toContain("2 facultades no cierran su cuota con lo que tienen agendado: faltarían 170 alumnos.");
    // Y dice que el trabajo es agendar, no pedir reserva.
    expect(r.frase).toContain("El plan que les queda por agendar da para cubrirlo.");
    expect(r.facultadesEnRiesgoAgendado).toBe(2);
  });

  it("cuando ni agendando el plan entero alcanza, lo dice: ahí sí hace falta reserva", () => {
    const b = { total: {
      ...bloque.total, facultades_en_riesgo: 1, alumnos_en_riesgo: 40,
      facultades_en_riesgo_agendado: 3, alumnos_en_riesgo_agendado: 200,
    } } as unknown as MonitoreoAulasEfectividadSeguimiento;
    const r = riesgoDeCierre(b)!;
    expect(r.frase).toContain("3 facultades no cierran su cuota con lo que tienen agendado");
    expect(r.frase).toContain("una seguiría corta");
    expect(r.frase).toContain("activar reservas");
  });

  it("la cifra del plan entero NO sustituye a la de lo agendado", () => {
    // Es el caso real de HSVG26ULT2: el motor daba 0 en riesgo porque contaba
    // aulas del plan que nadie ha agendado, y en pantalla convivía con un panel
    // que decía que cinco no llegaban.
    const b = { total: {
      ...bloque.total, facultades_en_riesgo: 0, alumnos_en_riesgo: 0,
      facultades_en_riesgo_agendado: 5, alumnos_en_riesgo_agendado: 120,
    } } as unknown as MonitoreoAulasEfectividadSeguimiento;
    expect(riesgoDeCierre(b)!.frase).not.toContain("todas las facultades cierran");
  });
});

describe("proyeccionDeLaFacultad", () => {
  it("cuando cierra hasta en el peor caso, lo dice así", () => {
    const p = proyeccionDeLaFacultad({ ...derecho, proyectado_pesimista: 400 } as MonitoreoAulasEfectividadFacultad)!;
    expect(p.cierraEnLoPeor).toBe(true);
    expect(p.frase).toBe("Cierra su cuota de 363 incluso en el peor caso.");
  });

  it("cuando sólo cierra el central, la frase lo condiciona", () => {
    const p = proyeccionDeLaFacultad(derecho)!;
    expect(p.cierra).toBe(true);
    expect(p.cierraEnLoPeor).toBe(false);
    expect(p.frase).toBe("Llega a 499 sobre una cuota de 363, si el rendimiento se mantiene.");
  });

  it("cuando no cierra dice cuánto falta", () => {
    const p = proyeccionDeLaFacultad({ ...derecho, proyectado: 300 } as MonitoreoAulasEfectividadFacultad)!;
    expect(p.frase).toBe("Se queda en 300 sobre una cuota de 363: le faltarían 63.");
  });

  it("sin cuota no se proyecta contra nada", () => {
    expect(proyeccionDeLaFacultad({ ...derecho, cuota: null } as MonitoreoAulasEfectividadFacultad)).toBeNull();
  });
});

describe("filaDeLaFacultad", () => {
  const conFilas = {
    total: bloque.total,
    facultades: [derecho, { ...derecho, facultad: "PSICOLOGÍA", faculty_key: "psicologia" }],
  } as unknown as MonitoreoAulasEfectividadSeguimiento;

  it("empareja por el nombre y por la clave", () => {
    expect(filaDeLaFacultad(conFilas, "DERECHO")?.faculty_key).toBe("derecho");
    expect(filaDeLaFacultad(conFilas, "psicologia")?.facultad).toBe("PSICOLOGÍA");
  });

  it("empareja con la tilde descompuesta, igual que el resto del perfil", () => {
    expect(filaDeLaFacultad(conFilas, "PSICOLOGÍA".normalize("NFD"))?.faculty_key).toBe("psicologia");
  });

  it("sin foco o sin coincidencia devuelve null, nunca otra facultad", () => {
    expect(filaDeLaFacultad(conFilas, undefined)).toBeNull();
    expect(filaDeLaFacultad(conFilas, "ARQUITECTURA")).toBeNull();
  });
});

describe("repartoDeSenales", () => {
  const con = (senales: string[]) => ({
    total: bloque.total,
    facultades: senales.map((senal, i) => ({ ...derecho, facultad: `F${i}`, senal })),
  } as unknown as MonitoreoAulasEfectividadSeguimiento);

  it("cuenta por la SEÑAL del motor, no por el signo de la diferencia", () => {
    // Las quince de HSVG2026 tienen el punto por encima o por debajo, y el
    // motor declara «conforme» a casi todas porque la banda las contiene.
    const r = repartoDeSenales(con(["conforme", "conforme", "sobre", "bajo"]))!;
    expect(r.frase).toBe("De 4 facultades: 2 como lo previsto · 1 por encima · 1 por debajo.");
  });

  it("las que no tienen vara se cuentan aparte, no como conformes", () => {
    const r = repartoDeSenales(con(["conforme", "sin_banda", "sin_previsto"]))!;
    expect(r.sinVara).toBe(2);
    expect(r.conforme).toBe(1);
    expect(r.frase).toContain("2 sin vara todavía");
  });

  it("no enumera lo que vale cero", () => {
    expect(repartoDeSenales(con(["conforme", "conforme"]))!.frase)
      .toBe("De 2 facultades: 2 como lo previsto.");
  });

  it("sin facultades no devuelve un reparto vacío", () => {
    expect(repartoDeSenales(bloque)).toBeNull();
  });
});

/**
 * **«Su banda» era quedarse corto: es un intervalo de confianza al 95 %.**
 *
 * Gonzalo, 2026-09-10: «¿más que su banda es el margen de error? siento que
 * podemos ser más académicos, hasta con un margen de confianza». Lo es —el motor
 * usa Z = 1,959964 sobre el error estándar del estimador de razón, con los
 * cursos-horario como conglomerados—, así que la pantalla lo nombra.
 */
describe("el margen del intervalo", () => {
  it("publica el ± cuando el intervalo es simétrico respecto del punto", () => {
    // 58,12 % con 52,15 – 64,09: 5,97 a cada lado.
    expect(lecturaDeEfectividad(bloque)!.margen).toBe(6);
  });

  it("NO publica el ± cuando el intervalo se recortó contra 0 o 100", () => {
    // El motor acota a [0, 1] porque τ es una fracción: aquí el extremo bajo
    // topó en cero y el «±» describiría un intervalo que no es el calculado.
    const recortado = {
      ...derecho, tau_observado: 0.05, banda_bajo: 0, banda_alto: 0.3,
    } as unknown as MonitoreoAulasEfectividadFacultad;
    expect(lecturaDeEfectividad(bloque, recortado)!.margen).toBeNull();
  });

  it("sin intervalo no hay margen que publicar", () => {
    const sinBanda = {
      ...derecho, banda_bajo: null, banda_alto: null, senal: "sin_banda",
    } as unknown as MonitoreoAulasEfectividadFacultad;
    expect(lecturaDeEfectividad(bloque, sinBanda)!.margen).toBeNull();
  });
});

/**
 * **Lo general Y lo específico, no lo uno en lugar de lo otro.**
 *
 * Gonzalo, 2026-09-10: «debe ser capaz de mostrar lo general pero también lo
 * específico por facultad cuando el selector esté sobre una facultad en
 * específico». La primera versión sustituía una lectura por otra, y el 57,3 % de
 * Derecho quedaba sin referencia: no se podía saber si va como el operativo o se
 * despega.
 */
describe("las dos lecturas conviven", () => {
  const conFilas = {
    total: bloque.total,
    facultades: [derecho],
  } as unknown as MonitoreoAulasEfectividadSeguimiento;

  it("la del conjunto se puede leer aunque haya una facultad en foco", () => {
    const suya = lecturaDeEfectividad(conFilas, derecho)!;
    const general = lecturaDeEfectividad(conFilas, null)!;
    expect(suya.observado).toBe(0.5726);
    expect(general.observado).toBe(0.5812);
    // Y son de universos distintos: la facultad mide sobre sus 3
    // cursos-horario, el conjunto sobre 56.
    expect([suya.aulas, general.aulas]).toEqual([3, 56]);
  });

  it("el riesgo del operativo no depende de la facultad mirada", () => {
    // Es la conclusión general y no deja de ser cierta porque se esté mirando
    // una facultad: el panel la enseña siempre.
    expect(riesgoDeCierre(conFilas)!.frase).toBe("Con lo agendado, todas las facultades cierran su cuota.");
  });
});

/**
 * **Un solo redondeo, o el panel se contradice en la misma línea.**
 *
 * En pantalla salió «51.3 % → 58.1 % · +6.7 pts». Las dos cifras venían de
 * `toFixed(1)` sobre el crudo —0,5135 cae por debajo del medio punto en
 * binario— y el chip, de `puntosEntre()`, que redondea a 51,4. 58,1 − 51,3 son
 * 6,8: quien resta lo que ve no llega a lo que el panel dice.
 */
describe("el redondeo de las tasas es uno solo", () => {
  it("la diferencia publicada cuadra con las cifras a un decimal", () => {
    const l = lecturaDeEfectividad(bloque)!;
    const unDecimal = (v: number) => Math.round(v * 1000) / 10;
    expect(unDecimal(l.observado!) - unDecimal(l.previsto!)).toBeCloseTo(l.puntos!, 5);
  });

  it("y 0,5135 redondea a 51,4, no a 51,3", () => {
    // El caso exacto que se vio en pantalla: `toFixed` da 51.3 y la resta 6.8.
    expect(Math.round(0.5135 * 1000) / 10).toBe(51.4);
    expect((0.5135 * 100).toFixed(1)).toBe("51.3");
  });
});
