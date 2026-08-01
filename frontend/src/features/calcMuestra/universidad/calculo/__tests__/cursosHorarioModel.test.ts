import { describe, expect, it } from "vitest";
import {
  alumnosPorCursoHorario,
  construirCursosHorarioModelo,
  cursosHorarioFinalMap,
  cursosHorarioNecesarios,
  estadoConfirmacionCursosHorario,
  li95EsFiable,
  type CursosHorarioEntradaFacultad,
} from "../cursosHorarioModel";

describe("alumnosPorCursoHorario", () => {
  it("toma el mínimo entre media y mediana", () => {
    expect(alumnosPorCursoHorario(32, 28.5)).toBe(28.5);
    expect(alumnosPorCursoHorario(20, 26)).toBe(20);
  });

  it("cae a la única medida disponible o null", () => {
    expect(alumnosPorCursoHorario(30, null)).toBe(30);
    expect(alumnosPorCursoHorario(null, 25)).toBe(25);
    expect(alumnosPorCursoHorario(null, null)).toBeNull();
    expect(alumnosPorCursoHorario(0, -3)).toBeNull();
  });
});

describe("cursosHorarioNecesarios", () => {
  it("es ceil(sobremuestra / alumnos-por-CH)", () => {
    expect(cursosHorarioNecesarios(100, 30)).toBe(4);
    expect(cursosHorarioNecesarios(90, 30)).toBe(3);
  });

  it("null sin divisor y 0 sin sobremuestra", () => {
    expect(cursosHorarioNecesarios(100, null)).toBeNull();
    expect(cursosHorarioNecesarios(0, 30)).toBe(0);
  });
});

describe("estadoConfirmacionCursosHorario", () => {
  const base = {
    confirmado: true,
    marcoDesactualizado: false,
    completo: true,
    actual: { Derecho: 4, Ciencias: 6 },
    guardado: { Derecho: 4, Ciencias: 6 },
  };

  it("solo acredita un plan idéntico, completo y sobre marco vigente", () => {
    expect(estadoConfirmacionCursosHorario(base)).toEqual({ vigente: true, puedeConfirmar: false });
    expect(estadoConfirmacionCursosHorario({ ...base, marcoDesactualizado: true }))
      .toEqual({ vigente: false, puedeConfirmar: false });
    expect(estadoConfirmacionCursosHorario({ ...base, completo: false }))
      .toEqual({ vigente: false, puedeConfirmar: false });
  });

  it("permite reconfirmar un cálculo distinto solo si está fresco y completo", () => {
    expect(estadoConfirmacionCursosHorario({ ...base, actual: { Derecho: 5, Ciencias: 6 } }))
      .toEqual({ vigente: false, puedeConfirmar: true });
  });
});

describe("construirCursosHorarioModelo", () => {
  // La sobremuestra (no la cuota neta) es el dividendo del cálculo de aulas.
  const entradas: CursosHorarioEntradaFacultad[] = [
    { facultad: "Ingeniería", cuota: 120, sobremuestra: 180, estAulaMediana: 30, estAulaMedia: 28, chMarcoElegible: 40, chTotal: 55, extra: 1 },
    { facultad: "Derecho", cuota: 60, sobremuestra: 90, estAulaMediana: 20, estAulaMedia: 24, chMarcoElegible: 12, chTotal: 18, extra: 0 },
    { facultad: "Sin medida", cuota: 40, sobremuestra: 60, estAulaMediana: null, estAulaMedia: null, chMarcoElegible: 5, chTotal: 9, extra: 2 },
  ];

  it("resuelve CH necesarios sobre la SOBREMUESTRA con el mínimo media/mediana", () => {
    const modelo = construirCursosHorarioModelo(entradas, "elegible");
    const ing = modelo.filas[0];
    expect(ing.alumnosPorCH).toBe(28);
    expect(ing.chNecesarios).toBe(Math.ceil(180 / 28)); // 7, NO ceil(120/28)=5
    expect(ing.chFinal).toBe(Math.ceil(180 / 28) + 1); // 8
    expect(ing.chBase).toBe(40); // base elegible
    const der = modelo.filas[1];
    expect(der.alumnosPorCH).toBe(20);
    expect(der.chNecesarios).toBe(Math.ceil(90 / 20)); // 5
    expect(der.chFinal).toBe(5);
  });

  it("marca incompleto cuando alguna facultad con cuota no tiene divisor", () => {
    const modelo = construirCursosHorarioModelo(entradas, "elegible");
    expect(modelo.filas[2].alumnosPorCH).toBeNull();
    expect(modelo.filas[2].chNecesarios).toBeNull();
    expect(modelo.filas[2].chFinal).toBeNull();
    expect(modelo.completo).toBe(false);
  });

  it("la base seleccionable cambia SOLO el inventario, no el divisor ni CH necesarios", () => {
    const eleg = construirCursosHorarioModelo(entradas, "elegible");
    const total = construirCursosHorarioModelo(entradas, "total");
    expect(total.filas[0].chBase).toBe(55);
    expect(eleg.filas[0].chBase).toBe(40);
    expect(total.base).toBe("total");
    // El tamaño de CH y los CH necesarios NO cambian con la base.
    expect(total.filas[0].alumnosPorCH).toBe(eleg.filas[0].alumnosPorCH);
    expect(total.filas[0].chNecesarios).toBe(eleg.filas[0].chNecesarios);
  });

  it("totaliza cuota, sobremuestra, necesarios, extra y final", () => {
    const modelo = construirCursosHorarioModelo(entradas, "elegible");
    expect(modelo.totalCuota).toBe(220);
    expect(modelo.totalSobremuestra).toBe(330);
    expect(modelo.totalExtra).toBe(3);
    expect(modelo.totalNecesarios).toBe(7 + 5);
    expect(modelo.totalFinal).toBe(8 + 5);
  });

  it("cursosHorarioFinalMap omite facultades sin plan", () => {
    const modelo = construirCursosHorarioModelo(entradas, "elegible");
    const mapa = cursosHorarioFinalMap(modelo);
    expect(mapa["Ingeniería"]).toBe(8);
    expect(mapa["Derecho"]).toBe(5);
    expect(mapa["Sin medida"]).toBeUndefined();
  });
});

describe("li95EsFiable", () => {
  it("es fiable con lo95 positivo y ≥15 CH", () => {
    expect(li95EsFiable(22, 40)).toBe(true);
    expect(li95EsFiable(22, 15)).toBe(true);
  });
  it("no es fiable sin lo95, con lo95 no positivo, o con <15 CH", () => {
    expect(li95EsFiable(null, 40)).toBe(false);
    expect(li95EsFiable(0, 40)).toBe(false);
    expect(li95EsFiable(22, 8)).toBe(false);
  });
  it("con nCh desconocido (null) confía en el lo95 (guard del backend)", () => {
    expect(li95EsFiable(22, null)).toBe(true);
  });
});

describe("construirCursosHorarioModelo — método (resumen)", () => {
  // Facultad grande con bootstrap fiable y una chica con lo95 NA (<15 CH).
  const entradas: CursosHorarioEntradaFacultad[] = [
    { facultad: "Grande", cuota: 120, sobremuestra: 180, estAulaMediana: 30, estAulaMedia: 28, estAulaLo95: 22, estAulaNCh: 40, chMarcoElegible: 40, chTotal: 55, extra: 0 },
    { facultad: "Chica", cuota: 40, sobremuestra: 60, estAulaMediana: 18, estAulaMedia: 16, estAulaLo95: null, estAulaNCh: 8, chMarcoElegible: 6, chTotal: 9, extra: 0 },
  ];

  it("expone las cuatro referencias por facultad", () => {
    const [g] = construirCursosHorarioModelo(entradas, "elegible", "min_mediana_media").filas;
    expect(g.refMediana).toBe(30);
    expect(g.refMedia).toBe(28);
    expect(g.refMin).toBe(28);
    expect(g.refLo95).toBe(22);
    expect(g.li95Fiable).toBe(true);
  });

  it("con LI 95% el divisor es la cota inferior y hay MÁS aulas que con mín(med,media)", () => {
    const min = construirCursosHorarioModelo(entradas, "elegible", "min_mediana_media").filas[0];
    const li = construirCursosHorarioModelo(entradas, "elegible", "li_bootstrap").filas[0];
    expect(min.alumnosPorCH).toBe(28); // mín(30, 28)
    expect(li.alumnosPorCH).toBe(22); // cota inferior del bootstrap
    expect(min.chNecesarios).toBe(Math.ceil(180 / 28)); // 7
    expect(li.chNecesarios).toBe(Math.ceil(180 / 22)); // 9 — más aulas
    expect(li.chNecesarios!).toBeGreaterThan(min.chNecesarios!);
    expect(li.metodoEfectivo).toBe("li_bootstrap");
  });

  it("una facultad chica (lo95 null) cae a mín(med,media) aunque el método sea LI", () => {
    const li = construirCursosHorarioModelo(entradas, "elegible", "li_bootstrap").filas[1];
    expect(li.li95Fiable).toBe(false);
    expect(li.refLo95).toBeNull();
    expect(li.metodoEfectivo).toBe("min_mediana_media");
    expect(li.alumnosPorCH).toBe(16); // mín(18, 16), NO el lo95 inexistente
    expect(li.chNecesarios).toBe(Math.ceil(60 / 16)); // 4
  });

  it("mediana y media puras usan su punto simple", () => {
    const med = construirCursosHorarioModelo(entradas, "elegible", "mediana").filas[0];
    const mea = construirCursosHorarioModelo(entradas, "elegible", "media").filas[0];
    expect(med.alumnosPorCH).toBe(30);
    expect(mea.alumnosPorCH).toBe(28);
  });

  it("el modelo recuerda el método elegido", () => {
    expect(construirCursosHorarioModelo(entradas, "elegible", "li_bootstrap").resumen).toBe("li_bootstrap");
    expect(construirCursosHorarioModelo(entradas, "elegible").resumen).toBe("min_mediana_media");
  });
});
