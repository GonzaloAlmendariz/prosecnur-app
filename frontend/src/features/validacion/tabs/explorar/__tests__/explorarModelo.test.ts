import { describe, expect, it } from "vitest";
import type { ExploradorDist, ExploradorFicha } from "../../../../../api/validacionExplorar";
import type { ViewDescriptor } from "../../../types";
import {
  cifrasClave,
  desviaciones,
  divergente,
  esResidual,
  fmtDecimal,
  fmtN,
  fraseBase,
  fraseCruceBase,
  lecturaInicial,
  modeloCalor,
  ordenarFilas,
  rangoColumnas,
  resolverBase,
} from "../explorarModelo";
import { completitud, conteoPorFamilia, coincide } from "../tiposVariable";

function kpi(title: string, value: number | string, subtitle = ""): ViewDescriptor {
  return { version: 1, kind: "kpi_card", title, subtitle, meta: { value }, plotly: { data: [], layout: {} } };
}

const UNI = {
  n_tras_filtro: 642,
  n_total: 1283,
  filtros_aplicados: 1,
  tipo: "so" as const,
  kpis: [kpi("Total casos", 642), kpi("Válidos", 600, "93.5% de la base"), kpi("Missing", "6.5%")],
};

const DIST: ExploradorDist = {
  tipo: "so",
  ordinal: false,
  base_n: 604,
  filas: [
    { codigo: "96", etiqueta: "Otro", n: 18, pct: 3 },
    { codigo: "2", etiqueta: "Independiente", n: 152, pct: 25.2 },
    { codigo: "1", etiqueta: "Dependiente", n: 189, pct: 31.3 },
    { codigo: "98", etiqueta: "No sabe", n: 5, pct: 0.8 },
    { codigo: "3", etiqueta: "Estudiante", n: 0, pct: 0 },
  ],
};

const FICHA = {
  opciones: ["1", "2", "3", "96", "98", "4"].map((codigo) => ({ codigo, etiqueta: codigo, n: 0 })),
  datos: { n_total: 1283, n_responden: 1200, n_sin_respuesta: 83, n_fuera_de_lista: 0, n_otro_textos: 18 },
} as unknown as ExploradorFicha;

describe("formatos", () => {
  it("separador de miles con coma y decimal con punto (es-PE)", () => {
    expect(fmtN(1283)).toBe("1,283");
    expect(fmtN(1234567)).toBe("1,234,567");
    expect(fmtDecimal(1234.56, 1)).toBe("1,234.6");
    expect(fmtDecimal(-0.04, 1)).toBe("0.0");
  });
});

describe("base en una frase (E4)", () => {
  it("con filtro: la distribución manda sobre la ficha y las tarjetas", () => {
    const base = resolverBase(UNI, DIST, FICHA);
    expect(base).toEqual({ nCasos: 642, nTotal: 1283, filtrado: true, responden: 604, sinRespuesta: 38 });
    expect(fraseBase(base)).toEqual({
      destacado: "642 de 1,283 casos",
      resto: " con el filtro activo; 604 responden y 38 quedan sin respuesta.",
    });
  });

  it("con filtro y sin dist, la ficha (calculada sin filtro) no se usa: se cae a la tarjeta", () => {
    expect(resolverBase(UNI, null, FICHA).responden).toBe(600);
  });

  it("sin filtro, la ficha da la base cuando no hay dist", () => {
    const base = resolverBase({ ...UNI, filtros_aplicados: 0, n_tras_filtro: 1283 }, null, FICHA);
    expect(base.responden).toBe(1200);
    expect(fraseBase(base).destacado).toBe("1,283 casos");
  });

  it("sin nada de dónde leer quién responde, la frase sólo dice la base", () => {
    const base = resolverBase({ ...UNI, kpis: [] }, null, null);
    expect(base.responden).toBeNull();
    expect(fraseBase(base).resto).toBe(" con el filtro activo.");
  });
});

describe("orden de barras (E6)", () => {
  it('por frecuencia, con "Otro" y "No sabe" al final', () => {
    expect(ordenarFilas(DIST.filas!, false).map((f) => f.etiqueta)).toEqual([
      "Dependiente",
      "Independiente",
      "Estudiante",
      "Otro",
      "No sabe",
    ]);
  });

  it("una ordinal respeta su orden", () => {
    expect(ordenarFilas(DIST.filas!, true).map((f) => f.codigo)).toEqual(["96", "2", "1", "98", "3"]);
  });

  it("los códigos fuera de la lista (cola con etiqueta = código) van al final, aun en ordinal", () => {
    const filas = [
      { codigo: "1", etiqueta: "Poco", n: 2, pct: 20 },
      { codigo: "2", etiqueta: "Mucho", n: 5, pct: 50 },
      { codigo: "77", etiqueta: "77", n: 9, pct: 30 },
    ];
    expect(ordenarFilas(filas, false).map((f) => f.codigo)).toEqual(["2", "1", "77"]);
    expect(ordenarFilas(filas, true).map((f) => f.codigo)).toEqual(["1", "2", "77"]);
    // Con la ficha manda la lista declarada.
    expect(ordenarFilas(filas, false, new Set(["1", "77"])).map((f) => f.codigo)).toEqual(["77", "1", "2"]);
  });

  it("una lista sin etiquetas (todas = código) no se marca entera como fuera", () => {
    const filas = [{ codigo: "1", etiqueta: "1", n: 1, pct: 50 }, { codigo: "2", etiqueta: "2", n: 3, pct: 50 }];
    expect(ordenarFilas(filas, false).map((f) => f.codigo)).toEqual(["2", "1"]);
  });

  it("opciones usadas cuenta sólo las de la lista y nombra los casos fuera", () => {
    const d: ExploradorDist = { ...DIST, filas: [...DIST.filas!, { codigo: "77", etiqueta: "77", n: 4, pct: 0.6 }] };
    const base = resolverBase({ ...UNI, filtros_aplicados: 0 }, d, null);
    expect(cifrasClave(UNI, d, null, base)[2]).toEqual({ valor: "4 de 5", rotulo: "opciones usadas", nota: "4 casos fuera de lista" });
  });

  it("reconoce residuales sin tildes ni mayúsculas", () => {
    expect(esResidual("Otra (especifique)")).toBe(true);
    expect(esResidual("NS/NR")).toBe(true);
    expect(esResidual("Otorongo")).toBe(false);
  });
});

describe("escala divergente", () => {
  const escala = ["Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo"].map(
    (etiqueta, i) => ({ codigo: String(i + 1), etiqueta, n: 10, pct: [8, 14, 14, 40, 24][i] }),
  );

  it("suma las mitades y deja el centro aparte", () => {
    const d = divergente(escala)!;
    expect(d.baja.pct).toBe(22);
    expect(d.centro?.pct).toBe(14);
    expect(d.alta.pct).toBe(64);
    // Cada lado lleva el nombre de su opción más cercana al centro, que nombra al grupo y es corto.
    expect([d.baja.etiqueta, d.centro?.etiqueta, d.alta.etiqueta]).toEqual(["En desacuerdo", "Ni uno ni otro", "De acuerdo"]);
    expect(d.segmentos.map((s) => s.lado)).toEqual(["baja", "baja", "centro", "alta", "alta"]);
    expect(d.segmentos[0].intensidad).toBeGreaterThan(d.segmentos[1].intensidad);
  });

  it("con menos de tres puntos no hay escala", () => {
    expect(divergente(escala.slice(0, 2))).toBeNull();
  });
});

describe("tira de cifras (E5)", () => {
  it("una de opciones, como el prototipo: responden de N, sin respuesta y opciones usadas", () => {
    const base = resolverBase({ ...UNI, filtros_aplicados: 0 }, DIST, FICHA);
    const cifras = cifrasClave(UNI, DIST, FICHA, base);
    expect(cifras.map((c) => c.rotulo)).toEqual([`responden, de ${fmtN(base.nCasos)}`, "sin respuesta", "opciones usadas"]);
    expect(cifras[0].valor).toBe(fmtN(base.responden ?? -1));
    // "No les correspondía" no existe todavía (pedido M6): la nota dice que "sin respuesta" junta los dos vacíos.
    expect(cifras[1].nota).toBe("por salto o vacío");
    expect(cifras[2]).toEqual({ valor: "4 de 6", rotulo: "opciones usadas", nota: "" });
  });

  it("una numérica: responden de N, media, mediana, mínimo, máximo y atípicos", () => {
    const num: ExploradorDist = {
      tipo: "num",
      ordinal: false,
      base_n: 126,
      num: { bins: [{ desde: 0, hasta: 10, n: 126 }], min: 900, p25: 2000, mediana: 3100, p75: 4000, max: 32000, media: 3450.5, n_atipicos: 1 },
    };
    const base = resolverBase({ ...UNI, filtros_aplicados: 0 }, num, null);
    const cifras = cifrasClave(UNI, num, null, base);
    expect(cifras.map((c) => c.rotulo)).toEqual([`responden, de ${fmtN(base.nCasos)}`, "media", "mediana", "mínimo", "máximo", "atípico"]);
    expect(cifras.map((c) => c.valor)).toEqual(["126", "3,450.5", "3,100", "900", "32,000", "1"]);
  });

  it("sin dist cae a las tarjetas del motor anterior", () => {
    const cifras = cifrasClave(UNI, null, null, resolverBase(UNI, null, null));
    expect(cifras.map((c) => c.rotulo)).toEqual(["Total casos", "Válidos", "Missing"]);
    expect(cifras[1]).toEqual({ rotulo: "Válidos", valor: "600", nota: "93.5% de la base" });
  });
});

describe("tabla de calor (E9)", () => {
  const tabla = {
    filas: [{ codigo: "1", etiqueta: "Dependiente", n: 100 }, { codigo: "2", etiqueta: "Independiente", n: 100 }],
    columnas: [{ codigo: "a", etiqueta: "Ate", n: 100 }, { codigo: "b", etiqueta: "Breña", n: 100 }],
    n: [[60, 40], [40, 60]],
  };

  it("por columna: cada columna suma 100, Total aparte, marca a 5 puntos", () => {
    const m = modeloCalor(tabla, "columna", 200);
    expect(m.filas[0].celdas.map((c) => c.valor)).toEqual([60, 40]);
    expect(m.filas[0].total?.valor).toBe(50);
    expect(m.filas[0].celdas.map((c) => c.marca)).toEqual(["arriba", "abajo"]);
    expect(m.filaTotal).toBeNull();
    expect(m.filas[0].celdas[0].peso).toBe(1);
    expect(m.titulo).toBe("Cada columna suma 100%");
    expect(m.nota).toBeNull();
  });

  it("por fila: compara con la fila Total", () => {
    const m = modeloCalor({ ...tabla, n: [[52, 48], [48, 52]] }, "fila", 200);
    expect(m.filas[0].celdas[0].valor).toBe(52);
    expect(m.filaTotal?.map((c) => c.valor)).toEqual([50, 50]);
    expect(m.filas[0].celdas[0].marca).toBeNull();
    expect(m.esquina.texto).toBe("100.0");
  });

  it("en n no hay comparación ni marcas; la esquina es la base", () => {
    const m = modeloCalor(tabla, "n", 200);
    expect(m.filas.flatMap((f) => f.celdas.map((c) => c.marca))).toEqual([null, null, null, null]);
    expect(m.totalGeneral).toBe(200);
    expect(m.esquina.texto).toBe("200");
    expect(desviaciones(m)).toEqual([]);
  });

  it("so × so da lo mismo con y sin filas[].n (payload viejo: se deduce de las celdas)", () => {
    const viejo = { ...tabla, filas: tabla.filas.map((f) => ({ ...f, n: null })) };
    for (const l of ["columna", "fila", "n"] as const) {
      expect(modeloCalor(viejo, l, 200)).toEqual(modeloCalor(tabla, l, 200));
    }
  });

  it("las mayores diferencias, de mayor a menor, con su lectura", () => {
    const d = desviaciones(modeloCalor(tabla, "columna", 200));
    expect(d).toHaveLength(3);
    expect(d[0].titulo).toBe('Ate: más "Dependiente"');
    expect(d[0].detalle).toBe("60.0% frente a 50.0% del total, 10.0 puntos por encima.");
    expect(rangoColumnas(modeloCalor(tabla, "columna", 200))).toEqual({ min: 100, max: 100, de: "columna" });
  });
});

// Revisión metodológica (2026-11-03): con una múltiple, un caso está en varias celdas; ningún total sale de sumarlas.
describe("tabla de calor con una múltiple: denominadores en casos", () => {
  // Réplica de E2_sex × d1_information en acnur_acg (dos opciones de nueve): 258 hombres y 301 mujeres responden
  // la múltiple (559 de la base de 560 con «Otro»); las celdas suman más que la fila porque se marcan varias.
  const soSm = {
    filas: [
      { codigo: "1", etiqueta: "Hombre", n: 258 },
      { codigo: "2", etiqueta: "Mujer", n: 301 },
      { codigo: "3", etiqueta: "Otro", n: 1 },
    ],
    columnas: [{ codigo: "a", etiqueta: "Redes sociales", n: 355 }, { codigo: "b", etiqueta: "Amigos o familiares", n: 101 }],
    n: [[164, 34], [190, 67], [1, 0]],
  };
  const base = 560;

  it('x única × y múltiple, por columna: el Total de "Mujer" es mujeres / base y los Totales suman 100', () => {
    const m = modeloCalor(soSm, "columna", base, "so", "sm");
    expect(m.filas[1].total?.valor).toBeCloseTo((100 * 301) / 560, 6);
    expect(m.filas.reduce((t, f) => t + (f.total?.valor ?? 0), 0)).toBeCloseTo(100, 6);
    expect(m.titulo).toBe("Cada columna suma 100%");
  });

  it("x única × y múltiple, por fila: ni el Total de la fila ni la esquina valen 100", () => {
    const m = modeloCalor(soSm, "fila", base, "so", "sm");
    expect(m.filas[1].celdas[0].valor).toBeCloseTo((100 * 190) / 301, 6);
    expect(m.filas[1].total?.texto).toBe("301");
    expect(m.esquina.texto).toBe("560");
    expect(m.filaTotal?.[0].valor).toBeCloseTo((100 * 355) / 560, 6);
    expect(m.titulo).toBe("% de cada fila que marca la opción de la columna");
    expect(m.nota).toContain("volumen de marcas");
  });

  it("el signo de cada diferencia es el mismo por columna y por fila, en los cuatro pares", () => {
    const smSo = {
      filas: soSm.columnas.map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta, n: c.n })),
      columnas: soSm.filas.map((f) => ({ codigo: f.codigo, etiqueta: f.etiqueta, n: f.n })),
      n: soSm.columnas.map((_, c) => soSm.n.map((fila) => fila[c])),
    };
    const smSm = {
      filas: [{ codigo: "a", etiqueta: "A", n: 50 }, { codigo: "b", etiqueta: "B", n: 40 }],
      columnas: [{ codigo: "a", etiqueta: "A", n: 50 }, { codigo: "b", etiqueta: "B", n: 40 }],
      n: [[50, 30], [30, 40]],
    };
    const soSo = { filas: [{ codigo: "1", etiqueta: "1", n: 60 }, { codigo: "2", etiqueta: "2", n: 40 }], columnas: [{ codigo: "a", etiqueta: "a", n: 50 }, { codigo: "b", etiqueta: "b", n: 50 }], n: [[40, 20], [10, 30]] };
    const casos = [
      [soSo, 100, "so", "so"],
      [soSm, base, "so", "sm"],
      [smSo, base, "sm", "so"],
      [smSm, 70, "sm", "sm"],
    ] as const;
    for (const [t, b, tx, ty] of casos) {
      const col = modeloCalor(t, "columna", b, tx, ty);
      const fila = modeloCalor(t, "fila", b, tx, ty);
      col.filas.forEach((f, r) =>
        f.celdas.forEach((c, k) => expect(Math.sign(c.dif ?? 0)).toBe(Math.sign(fila.filas[r].celdas[k].dif ?? 0))),
      );
    }
  });

  it("un payload sin filas[].n con una múltiple no vuelve a menciones: sin Total ni flechas", () => {
    const viejo = { ...soSm, filas: soSm.filas.map((f) => ({ ...f, n: null })) };
    const col = modeloCalor(viejo, "columna", base, "so", "sm");
    expect(col.filas.every((f) => f.total === null)).toBe(true);
    expect(col.filas.flatMap((f) => f.celdas.map((c) => c.marca)).every((m) => m === null)).toBe(true);
    const fila = modeloCalor(viejo, "fila", base, "so", "sm");
    expect(fila.filas.flatMap((f) => f.celdas.map((c) => c.texto)).every((t) => t === "—")).toBe(true);
  });

  it("con base 0 no hay NaN ni flechas", () => {
    for (const l of ["columna", "fila", "n"] as const) {
      const m = modeloCalor(soSm, l, 0, "so", "sm");
      const valores = m.filas.flatMap((f) => [...f.celdas, ...(f.total ? [f.total] : [])]).map((c) => c.valor);
      expect(valores.every(Number.isFinite)).toBe(true);
      expect(m.filas.flatMap((f) => f.celdas.map((c) => c.marca)).every((x) => x === null)).toBe(true);
    }
  });

  it('"Antes de leerlo" acota con el denominador de la lectura activa', () => {
    expect(rangoColumnas(modeloCalor(soSm, "columna", base, "so", "sm"))).toEqual({ min: 101, max: 355, de: "columna" });
    expect(rangoColumnas(modeloCalor(soSm, "fila", base, "so", "sm"))).toEqual({ min: 1, max: 301, de: "fila" });
  });

  it("única × múltiple abre por fila; lo demás, por columna", () => {
    expect(lecturaInicial("so", "sm")).toBe("fila");
    expect(lecturaInicial("sm", "so")).toBe("columna");
    expect(lecturaInicial("so", "so")).toBe("columna");
    expect(lecturaInicial("sm", "sm")).toBe("columna");
  });

  it('la base del cruce en una frase, con el "de" sólo cuando hay más casos que el cruce', () => {
    expect(fraseCruceBase({ base_n: 560, n_x: 1283, n_y: 560 })).toBe("560 casos responden las dos (de 1,283), sin ponderar");
    expect(fraseCruceBase({ base_n: 1283, n_x: 1283, n_y: 1283 })).toBe("1,283 casos responden las dos, sin ponderar");
    expect(fraseCruceBase({ base_n: 1, n_x: null, n_y: null })).toBe("1 caso responde las dos, sin ponderar");
  });
});

describe("tipos de variable (E1)", () => {
  it("completitud y conteo por familia", () => {
    expect(completitud({ n_validos: 3, n_nulos: 1 })).toBe(0.75);
    expect(completitud({ n_validos: 0, n_nulos: 0 })).toBeNull();
    expect(conteoPorFamilia([{ tipo: "so" }, { tipo: "so" }, { tipo: "mixto" }, { tipo: "texto" }])).toEqual({
      todas: 4, so: 2, sm: 0, num: 0, fecha: 0, texto: 1,
    });
  });

  it("busca por texto o código sin tildes", () => {
    expect(coincide({ name: "p14", label: "Situación laboral" }, "situacion")).toBe(true);
    expect(coincide({ name: "p14", label: "Situación laboral" }, "P14")).toBe(true);
    expect(coincide({ name: "p14", label: "Situación laboral" }, "edad")).toBe(false);
  });
});
