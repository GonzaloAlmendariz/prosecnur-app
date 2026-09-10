import { describe, expect, it } from "vitest";
import {
  filaDeLaFacultad, lecturaDeEfectividad, proyeccionDeLaFacultad, riesgoDeCierre,
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
    expect(r.frase).toContain("Ninguna facultad se queda corta");
    expect(r.frase).toContain("4 rinden por debajo");
    expect(r.facultadesEnRiesgo).toBe(0);
  });

  it("el número que decide es el de las que no cierran, con su déficit", () => {
    const b = { total: { ...bloque.total, facultades_en_riesgo: 2, alumnos_en_riesgo: 170 } } as unknown as MonitoreoAulasEfectividadSeguimiento;
    expect(riesgoDeCierre(b)!.frase).toBe("2 facultades no cierran su cuota con lo que tienen agendado: faltarían 170 alumnos.");
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
