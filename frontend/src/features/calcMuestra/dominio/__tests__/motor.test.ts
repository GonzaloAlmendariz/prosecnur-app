/**
 * Candado de fidelidad del motor muestral: debe reproducir las cifras del
 * caso de referencia verificado (documentación metodológica HST, 02 · Cifras
 * canónicas y 03.6 · Cálculo de muestra y de aulas). El caso vive en
 * PERFIL_EJEMPLO, marcado como ejemplo — el motor en producción opera sobre
 * datos del proyecto activo.
 *
 * Divergencias documentadas de la fuente (no son bugs):
 *  - La fórmula despeja ~2,353.5 → ceil 2,354 (el diseño la fija en 2,500).
 *  - La cuadratura canónica asigna el faltante a la unidad de mayor población;
 *    el Excel oficial puso su +1 en otra celda. Totales idénticos (2,500).
 *  - El E2 oficial es tabla de diseño: filas suman 4,049 (diseño 4,050) y su
 *    sobremuestra oficial es 4,865 (recomputada: 4,860).
 */
import { describe, expect, it } from "vitest";
import {
  afijacion,
  cobertura,
  decisionesPorDefecto,
  errorImplicito,
  escalonPara,
  escenario1,
  escenario2,
  estudiantesPorAula,
  nFormula,
  poblacionTotal,
  saltoK,
} from "../motor";
import { PERFIL_EJEMPLO, PLANTILLA_ESCUELA, PLANTILLA_UNIVERSIDAD } from "../presets";

const perfil = PERFIL_EJEMPLO;

describe("perfil de ejemplo — integridad del caso de referencia", () => {
  it("está marcado como ejemplo y su población suma 21,365 (10,538 / 10,827)", () => {
    expect(perfil.esEjemplo).toBe(true);
    expect(poblacionTotal(perfil.facultades)).toBe(21365);
    expect(perfil.facultades.reduce((acc, f) => acc + f.mujeres, 0)).toBe(10538);
    expect(perfil.facultades.reduce((acc, f) => acc + f.hombres, 0)).toBe(10827);
    for (const f of perfil.facultades) expect(f.mujeres + f.hombres).toBe(f.N);
  });

  it("el embudo de alumno cierra en la población y el de aula en el marco", () => {
    const alumno = perfil.embudoAlumno!;
    expect(alumno[0].conteo).toBe(29090);
    expect(alumno[alumno.length - 1].conteo).toBe(21365);
    const aula = perfil.embudoAula!;
    expect(aula[0].conteo).toBe(5262);
    expect(aula[aula.length - 1].conteo).toBe(2483);
    expect(perfil.marcoAulas).toBe(2483);
    // Cada paso de un embudo solo puede reducir el conteo.
    for (const pasos of [alumno, aula]) {
      for (let i = 1; i < pasos.length; i += 1) expect(pasos[i].conteo).toBeLessThanOrEqual(pasos[i - 1].conteo);
    }
  });

  it("los criterios opcionales llevan su impacto medido (c7 seguro, c8 restrictivo)", () => {
    const c7 = perfil.criteriosAula.find((c) => c.id === "c7")!;
    const c8 = perfil.criteriosAula.find((c) => c.id === "c8")!;
    expect(c7.impactoActivar).toEqual({ aulas: 2056, coberturaPct: 0.86, facultadesRotas: [] });
    expect(c8.impactoActivar?.aulas).toBe(799);
    expect(c8.impactoActivar?.facultadesRotas).toContain("Educación");
    expect(perfil.criteriosAula.filter((c) => c.tipo === "base")).toHaveLength(5);
  });
});

describe("fórmula de muestra (E1)", () => {
  it("despeja ≈2,354 con los parámetros del caso y N=21,365", () => {
    expect(nFormula(21365, perfil.parametros)).toBe(2354);
  });

  it("el error implícito de la cifra de diseño 2,500 es ≈2.39%", () => {
    const e = errorImplicito(2500, 21365, perfil.parametros)!;
    expect(e).toBeGreaterThan(0.0237);
    expect(e).toBeLessThan(0.024);
  });
});

describe("afijación unidad × sexo + cuadratura determinística", () => {
  const { cuotas, cuadratura } = afijacion(perfil.facultades, 2500);

  it("cierra exacto en 2,500 y la traza explica el ajuste", () => {
    expect(cuotas.reduce((acc, c) => acc + c.n, 0)).toBe(2500);
    expect(cuadratura.objetivo).toBe(2500);
    expect(cuadratura.sumaRedondeada).toBe(2498);
    expect(cuadratura.faltante).toBe(2);
    // Regla canónica: el faltante va a la unidad de mayor población, sexo mayoritario.
    expect(cuadratura.facultadAjustada).toBe("ciencias-ingenieria");
    expect(cuadratura.sexoAjustado).toBe("hombres");
  });

  it("reproduce la cuota oficial en toda unidad no tocada por el ajuste", () => {
    const esperado: Record<string, number> = {
      "arquitectura": 126, "arte-diseno": 119, "artes-escenicas": 69, "contables": 21,
      "ciencias-sociales": 151, "comunicacion": 97, "derecho": 347, "educacion": 23,
      "generales-ciencias": 393, "generales-letras": 389, "gastronomia": 15, "gestion": 115,
      "letras-ch": 26, "psicologia": 79,
    };
    for (const [id, n] of Object.entries(esperado)) {
      expect(cuotas.find((c) => c.facultadId === id)?.n, id).toBe(n);
    }
    const cyi = cuotas.find((c) => c.facultadId === "ciencias-ingenieria")!;
    expect(cyi.n).toBe(530); // 528 del redondeo + 2 de cuadratura
    expect(cyi.ajuste).toBe(2);
  });

  it("el desglose por sexo preserva la cuota de cada unidad", () => {
    for (const c of cuotas) expect(c.nMujeres + c.nHombres).toBe(c.n);
    const arq = cuotas.find((c) => c.facultadId === "arquitectura")!;
    expect([arq.nMujeres, arq.nHombres]).toEqual([87, 39]);
  });
});

describe("aulas por aplicar (E1) y bolsa operativa", () => {
  it("con la bolsa en 0 reproduce las 162 aulas del caso, unidad por unidad", () => {
    const r = escenario1(perfil, { parametros: perfil.parametros, bolsaExtraPorFacultad: 0 });
    expect(r.nDiseno).toBe(2500);
    const esperado: Record<string, number> = {
      "arquitectura": 10, "arte-diseno": 12, "artes-escenicas": 10, "contables": 2,
      "ciencias-ingenieria": 32, "ciencias-sociales": 11, "comunicacion": 8, "derecho": 20,
      "educacion": 3, "generales-ciencias": 19, "generales-letras": 17, "gastronomia": 2,
      "gestion": 7, "letras-ch": 4, "psicologia": 5,
    };
    for (const [id, aulas] of Object.entries(esperado)) {
      expect(r.cuotas.find((c) => c.facultadId === id)?.aulas, id).toBe(aulas);
    }
    expect(r.aulasBase).toBe(162);
    expect(r.aulasConBolsa).toBe(162);
    const arq = r.cuotas.find((c) => c.facultadId === "arquitectura")!;
    expect(arq.sobremuestra).toBe(189); // 126 × 1.5
    expect(arq.estAula).toBe(20); // mín(mediana 20, media 27.6)
  });

  it("bolsa B (+1/unidad) da 177 y bolsa C (+2/unidad) da 192", () => {
    const b = escenario1(perfil, { parametros: perfil.parametros, bolsaExtraPorFacultad: 1 });
    const c = escenario1(perfil, { parametros: perfil.parametros, bolsaExtraPorFacultad: 2 });
    expect(b.aulasConBolsa).toBe(177);
    expect(c.aulasConBolsa).toBe(192);
    expect(b.aulasBase).toBe(162);
  });

  it("estudiantes por aula = mín(mediana, media)", () => {
    const psicologia = perfil.facultades.find((f) => f.id === "psicologia")!;
    expect(estudiantesPorAula(psicologia, "min_mediana_media")).toBe(25); // mediana 25 < media 47.9
    const derecho = perfil.facultades.find((f) => f.id === "derecho")!;
    expect(estudiantesPorAula(derecho, "min_mediana_media")).toBe(26.7); // media 26.7 < mediana 33
  });

  describe("estudiantesPorAula — método li_bootstrap", () => {
    it("devuelve la cota inferior del bootstrap (lo95) cuando existe", () => {
      const insumos = { estAulaMediana: 30, estAulaMedia: 28, estAulaLo95: 22 };
      expect(estudiantesPorAula(insumos, "li_bootstrap")).toBe(22);
      // Los otros métodos ignoran lo95.
      expect(estudiantesPorAula(insumos, "mediana")).toBe(30);
      expect(estudiantesPorAula(insumos, "media")).toBe(28);
      expect(estudiantesPorAula(insumos, "min_mediana_media")).toBe(28);
    });

    it("cae a mín(mediana, media) cuando lo95 es null (facultad chica, guard R)", () => {
      const chica = { estAulaMediana: 30, estAulaMedia: 26, estAulaLo95: null };
      expect(estudiantesPorAula(chica, "li_bootstrap")).toBe(26); // = min_mediana_media
      expect(estudiantesPorAula(chica, "li_bootstrap")).toBe(
        estudiantesPorAula(chica, "min_mediana_media"),
      );
    });

    it("con lo95 null y una sola medida, usa esa medida", () => {
      expect(estudiantesPorAula({ estAulaMediana: null, estAulaMedia: 24, estAulaLo95: null }, "li_bootstrap")).toBe(24);
      expect(estudiantesPorAula({ estAulaMediana: 31, estAulaMedia: null, estAulaLo95: null }, "li_bootstrap")).toBe(31);
    });
  });
});

describe("escenario 2 (cada unidad como estrato)", () => {
  const r = escenario2(perfil)!;

  it("expone la tabla oficial (filas 4,049 · diseño 4,050 · 235 aulas · sobremuestra 4,865)", () => {
    expect(r.totalOficial).toBe(4049);
    expect(r.totalDiseno).toBe(4050);
    expect(r.aulasOficial).toBe(235);
    expect(r.sobremuestraTotal).toBe(4865); // oficial (recomputada daría 4,860)
  });

  it("asigna el escalón por tamaño (95/5 grandes · 95/7 medianas · 90/10 chicas)", () => {
    const config = perfil.escenario2!;
    expect(escalonPara(config, 4512)).toMatchObject({ confianza: 0.95, margenError: 0.05 });
    expect(escalonPara(config, 590)).toMatchObject({ confianza: 0.95, margenError: 0.07 });
    expect(escalonPara(config, 183)).toMatchObject({ confianza: 0.9, margenError: 0.1 });
  });

  it("recomputa con p propia por unidad y deff del E2, y expone la cifra oficial al lado", () => {
    const cyi = r.filas.find((fila) => fila.facultadId === "ciencias-ingenieria")!;
    expect(cyi.p).toBe(0.2);
    expect(cyi.nFormula).toBe(341); // despeje; el diseño oficial fijó 354
    expect(cyi.nOficial).toBe(354);
    expect(cyi.W).toBe(2.416);
  });
});

describe("cobertura del cruce alumno × aula", () => {
  it("reproduce 19,711 alcanzables (92.3%) y factibilidad 15/15", () => {
    const r1 = escenario1(perfil, { parametros: perfil.parametros, bolsaExtraPorFacultad: 0 });
    const cob = cobertura(perfil, r1.cuotas);
    expect(cob.totalElegibles).toBe(21365);
    expect(cob.totalAlcanzables).toBe(19711);
    expect(cob.pctGlobal!).toBeGreaterThan(0.922);
    expect(cob.pctGlobal!).toBeLessThan(0.924);
    expect(cob.filas.every((fila) => fila.factible === true)).toBe(true);
  });
});

describe("selección sistemática", () => {
  it("k = marco / aulas a seleccionar", () => {
    expect(saltoK(2483, 162)).toBeCloseTo(15.33, 2);
    expect(saltoK(null, 162)).toBeNull();
    expect(saltoK(2483, 0)).toBeNull();
  });
});

describe("plantillas genéricas (el motor no fija datos de un proyecto)", () => {
  it("las plantillas parten sin datos de población ni marca institucional", () => {
    for (const plantilla of [PLANTILLA_UNIVERSIDAD, PLANTILLA_ESCUELA]) {
      expect(plantilla.esEjemplo).toBe(false);
      expect(plantilla.facultades).toHaveLength(0);
      expect(plantilla.universo).toBeNull();
      expect(plantilla.embudoAlumno).toBeNull();
      expect(plantilla.criteriosAula.filter((c) => c.tipo === "base").length).toBeGreaterThanOrEqual(5);
      // Sin impactos precargados: se miden sobre la base del proyecto.
      expect(plantilla.criteriosAula.every((c) => c.impactoActivar == null)).toBe(true);
    }
    expect(PLANTILLA_UNIVERSIDAD.modeloDatos.bases).toBe(2);
    expect(PLANTILLA_ESCUELA.modeloDatos.bases).toBe(1);
    expect(PLANTILLA_ESCUELA.etiquetaUnidad).toBe("grado");
    expect(PLANTILLA_ESCUELA.criteriosAula.some((c) => c.id === "sede" && c.tipo === "base")).toBe(true);
  });

  it("el motor opera con una plantilla vacía sin reventar", () => {
    const r = escenario1(PLANTILLA_UNIVERSIDAD, {
      parametros: PLANTILLA_UNIVERSIDAD.parametros,
      bolsaExtraPorFacultad: 1,
    });
    expect(r.N).toBe(0);
    expect(r.cuotas).toHaveLength(0);
    expect(escenario2(PLANTILLA_UNIVERSIDAD)!.totalOficial).toBeNull();
  });

  it("las decisiones por defecto respetan la bolsa sugerida del perfil", () => {
    const d = decisionesPorDefecto(perfil);
    expect(d.bolsaExtraPorFacultad).toBe(1);
    expect(d.parametros.nDiseno).toBe(2500);
    expect(d.escenario).toBe("e1");
    expect(d.opcionalesActivos).toEqual([]);
  });
});
