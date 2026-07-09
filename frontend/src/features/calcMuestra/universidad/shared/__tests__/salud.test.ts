/**
 * derivarSaludDiseno: veredicto de salud del diseño derivado de cifras que el
 * motor ya validó. Un diseño sano no produce observaciones; un censo (n ≥ N),
 * una selección que no cubre el objetivo, facultades sin aula titular, un
 * score bajo, balance fuera de banda o un CV de pesos sobre umbral sí.
 * Los peligros van siempre antes que las advertencias.
 */
import { describe, expect, it } from "vitest";
import {
  derivarSaludDiseno,
  esCenso,
  scoreEscala100,
  saludComoRiesgos,
  type SaludPiezas,
} from "../salud";

/** Diseño sano de referencia: cada test degrada solo la pieza que le toca. */
const piezasSanas: SaludPiezas = {
  componentes: [
    { etiqueta: "Nivel universidad", nObjetivo: 2500, marcoN: 23991 },
    { etiqueta: "Nivel facultad", nObjetivo: 4499, marcoN: 23991 },
  ],
  selectionReady: true,
  estudiantesEsperados: 2600,
  objetivoEntrevistas: 2500,
  facultadesCubiertas: ["Ciencias", "Letras", "Derecho"],
  facultadesMarco: ["Ciencias", "Letras", "Derecho"],
  representatividad: 88,
  balanceFuera: 0,
  balanceEvaluadas: 12,
  cvPesos: 0.31,
  cvWarn: 0.5,
  cvCritical: 1,
};

describe("derivarSaludDiseno", () => {
  it("diseño sano: cero observaciones", () => {
    expect(derivarSaludDiseno(piezasSanas)).toEqual([]);
  });

  it("censo: n objetivo ≥ N del componente es danger (caso QA: N=2,356 con n=4,050)", () => {
    const obs = derivarSaludDiseno({
      ...piezasSanas,
      componentes: [
        { etiqueta: "Nivel universidad", nObjetivo: 2500, marcoN: 23991 },
        { etiqueta: "Nivel facultad", nObjetivo: 4050, marcoN: 2356 },
      ],
    });
    expect(obs).toHaveLength(1);
    expect(obs[0].nivel).toBe("danger");
    expect(obs[0].id).toContain("censo");
    expect(obs[0].titulo).toContain("censo");
    expect(obs[0].titulo).toContain("2,356");
    expect(obs[0].detalle).toContain("Nivel facultad");
    expect(obs[0].detalle).toContain("4,050");
  });

  it("censo: el caso límite n = N también cuenta", () => {
    expect(esCenso(2356, 2356)).toBe(true);
    expect(esCenso(2355, 2356)).toBe(false);
    expect(esCenso(0, 2356)).toBe(false);
    expect(esCenso(100, 0)).toBe(false);
  });

  it("brecha de cobertura: esperados < objetivo es warn con el % de cobertura", () => {
    const obs = derivarSaludDiseno({
      ...piezasSanas,
      estudiantesEsperados: 981,
      objetivoEntrevistas: 2500,
    });
    expect(obs).toHaveLength(1);
    expect(obs[0].nivel).toBe("warn");
    expect(obs[0].id).toBe("brecha-cobertura");
    expect(obs[0].titulo).toContain("39.2%");
    expect(obs[0].detalle).toContain("981");
    expect(obs[0].detalle).toContain("2,500");
    expect(obs[0].accion).toContain("Objetivo de muestra");
  });

  it("brecha de cobertura: sin selección no se evalúa", () => {
    const obs = derivarSaludDiseno({
      ...piezasSanas,
      selectionReady: false,
      estudiantesEsperados: 0,
      facultadesCubiertas: [],
    });
    expect(obs).toEqual([]);
  });

  it("cobertura parcial de facultades: warn con conteo y ausentes", () => {
    const obs = derivarSaludDiseno({
      ...piezasSanas,
      facultadesMarco: ["Ciencias", "Letras", "Derecho", "Arte", "Educación", "Gestión"],
      facultadesCubiertas: ["Ciencias", "Letras", "Derecho", "Arte"],
    });
    expect(obs).toHaveLength(1);
    expect(obs[0].nivel).toBe("warn");
    expect(obs[0].id).toBe("facultades-sin-titular");
    expect(obs[0].titulo).toContain("4 de 6");
    expect(obs[0].titulo).toContain("2 quedan sin presencia");
    expect(obs[0].detalle).toContain("Educación");
    expect(obs[0].detalle).toContain("Gestión");
  });

  it("cobertura de facultades: compara etiquetas normalizadas (tildes/mayúsculas)", () => {
    const obs = derivarSaludDiseno({
      ...piezasSanas,
      facultadesMarco: ["EDUCACIÓN", "Ciencias", "Letras"],
      facultadesCubiertas: ["educacion", "CIENCIAS", "Letras"],
    });
    expect(obs).toEqual([]);
  });

  it("score bajo: < 50 es danger (34/100 de la ficha), 50-69 es warn", () => {
    const bajo = derivarSaludDiseno({ ...piezasSanas, representatividad: 34 });
    expect(bajo).toHaveLength(1);
    expect(bajo[0].nivel).toBe("danger");
    expect(bajo[0].titulo).toContain("34/100");

    const justo = derivarSaludDiseno({ ...piezasSanas, representatividad: 62 });
    expect(justo).toHaveLength(1);
    expect(justo[0].nivel).toBe("warn");
    expect(justo[0].titulo).toContain("62/100");

    expect(derivarSaludDiseno({ ...piezasSanas, representatividad: 70 })).toEqual([]);
  });

  it("score en escala 0-1: se normaliza igual que classroomScore", () => {
    expect(scoreEscala100(0.34)).toBeCloseTo(34);
    expect(scoreEscala100(88)).toBe(88);
    expect(scoreEscala100(null)).toBeNull();
    const obs = derivarSaludDiseno({ ...piezasSanas, representatividad: 0.34 });
    expect(obs[0].nivel).toBe("danger");
    expect(obs[0].titulo).toContain("34/100");
  });

  it("balance fuera de tolerancia: warn agregado con conteo", () => {
    const obs = derivarSaludDiseno({ ...piezasSanas, balanceFuera: 3, balanceEvaluadas: 12 });
    expect(obs).toHaveLength(1);
    expect(obs[0].nivel).toBe("warn");
    expect(obs[0].titulo).toContain("3 de 12");
  });

  it("CV de pesos: sobre el umbral warn es warn; sobre el crítico es danger", () => {
    const warn = derivarSaludDiseno({ ...piezasSanas, cvPesos: 0.74 });
    expect(warn).toHaveLength(1);
    expect(warn[0].nivel).toBe("warn");
    expect(warn[0].titulo).toContain("0.74");
    expect(warn[0].titulo).toContain("0.50");

    const danger = derivarSaludDiseno({ ...piezasSanas, cvPesos: 1.2 });
    expect(danger[0].nivel).toBe("danger");

    expect(derivarSaludDiseno({ ...piezasSanas, cvPesos: null })).toEqual([]);
    expect(derivarSaludDiseno({ ...piezasSanas, cvPesos: 0.5 })).toEqual([]);
  });

  it("diseño degradado completo (perfil del QA): peligros primero, luego advertencias", () => {
    const obs = derivarSaludDiseno({
      ...piezasSanas,
      componentes: [
        { etiqueta: "Nivel universidad", nObjetivo: 2500, marcoN: 23991 },
        { etiqueta: "Nivel facultad", nObjetivo: 4050, marcoN: 2356 },
      ],
      estudiantesEsperados: 981,
      objetivoEntrevistas: 2500,
      facultadesMarco: Array.from({ length: 16 }, (_, i) => `Facultad ${i + 1}`),
      facultadesCubiertas: Array.from({ length: 10 }, (_, i) => `Facultad ${i + 1}`),
      representatividad: 34,
      balanceFuera: 4,
      balanceEvaluadas: 12,
      cvPesos: 0.74,
    });
    expect(obs.length).toBe(6);
    const niveles = obs.map((o) => o.nivel);
    expect(niveles.slice(0, 2)).toEqual(["danger", "danger"]);
    expect(niveles.slice(2)).toEqual(["warn", "warn", "warn", "warn"]);
    expect(obs.some((o) => o.titulo.includes("10 de 16"))).toBe(true);
  });
});

describe("saludComoRiesgos", () => {
  it("mapea danger→alta y warn→media para el rail de riesgos", () => {
    const obs = derivarSaludDiseno({ ...piezasSanas, representatividad: 34, cvPesos: 0.74 });
    const riesgos = saludComoRiesgos(obs);
    expect(riesgos).toHaveLength(2);
    expect(riesgos[0].severity).toBe("alta");
    expect(riesgos[1].severity).toBe("media");
    expect(riesgos[0].code).toBe("salud_representatividad-baja");
    expect(riesgos[1].detail).toContain("Simulación");
  });
});
