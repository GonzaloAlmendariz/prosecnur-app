import { describe, expect, it } from "vitest";

import { normalizeMonitoreoCuotasEstado } from "../../../../api/monitoreoCuotas";
import {
  barraDeCategoria,
  borradorDeCuota,
  borradorNuevo,
  categoriasVisibles,
  coberturaATexto,
  conBase,
  cuotaElegida,
  entradasConBorrador,
  entradasSinCuota,
  faseCuotas,
  idGuardado,
  marcaReadinessCuotas,
  problemaDelBorrador,
  reducirBorrador,
  restoDeCategoria,
  resumenCuota,
  sumaDeMetas,
  textoACobertura,
  textoAMeta,
} from "./avanceCuotasModelo";

const sinSeparador = (t: string) => t.replace(/(\d)[.,](\d)/g, "$1|$2");

// Cifras reales del estudio (coordinador, 2026-10-22): Docentes Campus por
// dedicación con cobertura 0.312 → TPA 1939/605, DTC 631/197, TPC20 29/10.
const ESTADO = normalizeMonitoreoCuotasEstado({
  ok: true,
  avisos: [],
  publicos: [
    { actor: "Docentes Campus", universo: 2599, efectivas: 481, meta: 811, variables: [{ variable: "Dedicación", categorias: 3 }, { variable: "Departamento académico", categorias: 15 }] },
    { actor: "Administrativos", universo: 1800, efectivas: 200, meta: 540, variables: [{ variable: "Puesto", categorias: 91 }] },
  ],
  cuotas: [{
    id: "q1", actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312, universo: 2599, meta: 812, efectivas: 481,
    avance: 0.592, categorias_cumplidas: 0, categorias_total: 3, sin_dato: 0,
    categorias: [
      { categoria: "TPA", universo: 1939, meta: 605, efectivas: 350, falta: 255, avance: 0.578, tasa: 0.18, estado: "en_curso" },
      { categoria: "DTC", universo: 631, meta: 197, efectivas: 125, falta: 72, avance: 0.634, tasa: 0.198, estado: "en_curso" },
      { categoria: "TPC20", universo: 29, meta: 10, efectivas: 6, falta: 4, avance: 0.6, tasa: 0.207, estado: "en_curso" },
    ],
  }],
});

const PUESTOS = Array.from({ length: 91 }, (_, i) => ({
  categoria: i === 90 ? "Sin dato" : `Puesto ${i + 1}`,
  universo: 20 + i, meta: i % 7 === 0 ? 0 : 6 + (i % 5), efectivas: i % 3, falta: 0, estado: "",
}));

describe("fases y readiness de Cuotas", () => {
  it("false solo mientras carga; los terminales se clasifican", () => {
    expect(faseCuotas({ estado: null, cargando: true, error: "" })).toBe("cargando");
    expect(faseCuotas({ estado: null, cargando: false, error: "x" })).toBe("error");
    expect(faseCuotas({ estado: { ...ESTADO, publicos: [] }, cargando: false, error: "" })).toBe("sin-universo");
    expect(faseCuotas({ estado: { ...ESTADO, cuotas: [] }, cargando: false, error: "" })).toBe("sin-cuotas");
    expect(faseCuotas({ estado: ESTADO, cargando: false, error: "" })).toBe("listo");
    expect(marcaReadinessCuotas("cargando")).toBe("false");
    for (const f of ["error", "sin-universo", "sin-cuotas", "listo"] as const) expect(marcaReadinessCuotas(f)).not.toBe("false");
    expect(marcaReadinessCuotas("sin-cuotas")).toBe("vacio:sin-cuotas");
  });
});

describe("lectura de una cuota", () => {
  it("el resumen lleva frecuencia y base y cuenta las categorías cumplidas", () => {
    const r = resumenCuota(ESTADO.cuotas[0]);
    expect(r.efectivas).toBe(481);
    expect(r.meta).toBe(812);
    expect(sinSeparador(r.avanceTexto)).toBe("59|2 % · 481 de 812");
    expect(r.cumplidas).toBe("0 de 3 categorías cumplidas");
    expect(sinSeparador(r.cobertura)).toBe("cobertura 31|2 %");
    expect(r.tono).toBe("en_curso");
  });

  it("sin cobertura dice que las metas se escribieron a mano", () => {
    expect(resumenCuota({ ...ESTADO.cuotas[0], cobertura: null }).cobertura).toBe("metas escritas a mano");
  });

  it("el foco elige la cuota; uno desconocido cae en la primera", () => {
    expect(cuotaElegida(ESTADO.cuotas, "q1")?.id).toBe("q1");
    expect(cuotaElegida(ESTADO.cuotas, "nada")?.id).toBe("q1");
    expect(cuotaElegida([], "q1")).toBeNull();
  });

  it("orden por brecha, universo o nombre; «Sin dato» siempre al final", () => {
    const cats = normalizeMonitoreoCuotasEstado({ cuotas: [{ id: "q", actor: "A", variable: "Puesto", categorias: PUESTOS.map((p) => ({ ...p, falta: Math.max(0, p.meta - p.efectivas) })) }] }).cuotas[0].categorias;
    const brecha = categoriasVisibles(cats, "brecha", "");
    expect(brecha).toHaveLength(91);
    expect(brecha[brecha.length - 1].categoria).toBe("Sin dato");
    expect((brecha[0].falta ?? 0) >= (brecha[1].falta ?? 0)).toBe(true);
    const universo = categoriasVisibles(cats, "universo", "");
    expect(universo[0].categoria).toBe("Puesto 90");
    expect(categoriasVisibles(cats, "nombre", "").slice(0, 3).map((c) => c.categoria)).toEqual(["Puesto 1", "Puesto 2", "Puesto 3"]);
  });

  it("el filtro ignora tildes y mayúsculas", () => {
    const cats = ESTADO.cuotas[0].categorias.concat([{ ...ESTADO.cuotas[0].categorias[0], categoria: "Contratado a plazo" }]);
    expect(categoriasVisibles(cats, "brecha", "tpc").map((c) => c.categoria)).toEqual(["TPC20"]);
    expect(categoriasVisibles(cats, "brecha", "CONTRATADO").map((c) => c.categoria)).toEqual(["Contratado a plazo"]);
  });

  it("la barra bullet: relleno sobre la meta y marca; pasarse cruza la marca", () => {
    expect(barraDeCategoria({ meta: 605, efectivas: 350 })).toEqual({ relleno: (350 / 605) * 100, marca: 100, pasada: false });
    const pasada = barraDeCategoria({ meta: 10, efectivas: 12 });
    expect(pasada.relleno).toBe(100);
    expect(pasada.marca).toBeCloseTo((10 / 12) * 100);
    expect(pasada.pasada).toBe(true);
    expect(barraDeCategoria({ meta: 0, efectivas: 0 })).toEqual({ relleno: 0, marca: null, pasada: false });
  });

  it("lo que falta, lo que sobra y lo que no tiene meta", () => {
    expect(restoDeCategoria({ meta: 605, efectivas: 350, falta: 255 })).toBe("faltan 255");
    expect(restoDeCategoria({ meta: 10, efectivas: 12, falta: 0 })).toBe("sobran 2");
    expect(restoDeCategoria({ meta: 10, efectivas: 10, falta: 0 })).toBe("al día");
    expect(restoDeCategoria({ meta: 0, efectivas: 3, falta: 0 })).toBe("sin meta");
  });

  it("porcentaje siempre con su frecuencia y su base", () => {
    expect(sinSeparador(conBase(350, 1939))).toBe("18|1 % · 350 de 1|939");
    expect(conBase(0, 0)).toBe("— · 0 de 0");
  });
});

describe("borrador del panel", () => {
  it("una cuota nueva toma la cobertura por defecto del público: meta / universo", () => {
    const b = borradorNuevo(ESTADO.publicos);
    expect(b.actor).toBe("Docentes Campus");
    expect(b.cobertura).toBe(coberturaATexto(811 / 2599));
    expect(b.cobertura).toBe("31.2");
  });

  it("textos de cobertura y meta", () => {
    expect(textoACobertura("31.2")).toBeCloseTo(0.312);
    expect(textoACobertura("31,2 %")).toBeCloseTo(0.312);
    expect(textoACobertura("")).toBeNull();
    expect(textoACobertura("140")).toBeNull();
    expect(textoAMeta("605")).toBe(605);
    expect(textoAMeta("1,939")).toBe(1939);
    expect(textoAMeta("-3")).toBe(0);
    expect(textoAMeta("")).toBe(0);
  });

  it("cambiar de público o de variable vacía las metas; la propuesta las llena", () => {
    let b = borradorNuevo(ESTADO.publicos);
    b = reducirBorrador(b, { tipo: "variable", variable: "Dedicación" });
    b = reducirBorrador(b, {
      tipo: "propuesta",
      propuesta: { actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312, categorias: [
        { categoria: "TPA", universo: 1939, meta: 605 }, { categoria: "DTC", universo: 631, meta: 197 }, { categoria: "TPC20", universo: 29, meta: 10 },
      ] },
    });
    expect(sumaDeMetas(b)).toBe(812);
    b = reducirBorrador(b, { tipo: "meta", categoria: "TPA", meta: "600" });
    expect(sumaDeMetas(b)).toBe(807);
    expect(reducirBorrador(b, { tipo: "variable", variable: "Departamento académico" }).filas).toEqual([]);
    const otro = reducirBorrador(b, { tipo: "publico", actor: "Administrativos", publicos: ESTADO.publicos });
    expect(otro).toMatchObject({ actor: "Administrativos", variable: "", filas: [], cobertura: "30" });
  });

  it("una propuesta con cobertura nula conserva la escrita", () => {
    const b = reducirBorrador({ ...borradorNuevo(ESTADO.publicos), variable: "V", cobertura: "25" }, {
      tipo: "propuesta", propuesta: { actor: "Docentes Campus", variable: "V", cobertura: null, categorias: [{ categoria: "x", universo: 3, meta: null }] },
    });
    expect(b.cobertura).toBe("25");
    expect(b.filas[0].meta).toBe("0");
  });

  it("no se guarda sin variable, sin metas, con cobertura inválida o duplicada", () => {
    const base = { ...borradorNuevo(ESTADO.publicos), variable: "Departamento académico", filas: [{ categoria: "a", universo: 1, meta: "1" }] };
    expect(problemaDelBorrador({ ...base, variable: "" }, ESTADO.cuotas)).toMatch(/variable/);
    expect(problemaDelBorrador({ ...base, filas: [] }, ESTADO.cuotas)).toMatch(/Propón/);
    expect(problemaDelBorrador({ ...base, cobertura: "abc" }, ESTADO.cuotas)).toMatch(/porcentaje/);
    expect(problemaDelBorrador({ ...base, variable: "Dedicación" }, ESTADO.cuotas)).toMatch(/Ya hay una cuota/);
    expect(problemaDelBorrador(base, ESTADO.cuotas)).toBe("");
    // Editar la propia no cuenta como duplicada.
    expect(problemaDelBorrador(borradorDeCuota(ESTADO.cuotas[0]), ESTADO.cuotas)).toBe("");
  });

  it("guardar manda la configuración completa: reemplaza o agrega; quitar la saca", () => {
    const editada = reducirBorrador(borradorDeCuota(ESTADO.cuotas[0]), { tipo: "meta", categoria: "TPC20", meta: "12" });
    const reemplazo = entradasConBorrador(ESTADO.cuotas, editada);
    expect(reemplazo).toHaveLength(1);
    expect(reemplazo[0]).toMatchObject({ id: "q1", cobertura: 0.312, metas: { TPA: 605, DTC: 197, TPC20: 12 } });

    const nueva = { ...borradorNuevo(ESTADO.publicos, "Administrativos"), variable: "Puesto", filas: [{ categoria: "Analista", universo: 40, meta: "12" }] };
    const agregada = entradasConBorrador(ESTADO.cuotas, nueva);
    expect(agregada.map((e) => e.id ?? "nueva")).toEqual(["q1", "nueva"]);
    expect(agregada[1]).toMatchObject({ actor: "Administrativos", variable: "Puesto", metas: { Analista: 12 } });

    expect(entradasSinCuota(ESTADO.cuotas, "q1")).toEqual([]);
  });

  it("tras guardar una cuota nueva se ubica por público y variable", () => {
    const tras = { ...ESTADO, cuotas: [...ESTADO.cuotas, { ...ESTADO.cuotas[0], id: "cuota-ab12", actor: "Administrativos", variable: "Puesto" }] };
    expect(idGuardado(tras, { ...borradorNuevo(ESTADO.publicos, "Administrativos"), variable: "Puesto" })).toBe("cuota-ab12");
    expect(idGuardado(tras, borradorDeCuota(ESTADO.cuotas[0]))).toBe("q1");
  });
});
