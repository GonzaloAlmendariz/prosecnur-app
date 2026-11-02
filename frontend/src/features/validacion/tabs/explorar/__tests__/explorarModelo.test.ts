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
      resto: " con el filtro activo · 604 responden y 38 quedan sin respuesta.",
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
  it("por frecuencia, con «Otro» y «No sabe» al final", () => {
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
    expect(cifrasClave(UNI, d, null, base)[3]).toEqual({ rotulo: "Opciones usadas", valor: "4 de 5", nota: "4 casos fuera de lista" });
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
    expect(d.segmentos.map((s) => s.lado)).toEqual(["baja", "baja", "centro", "alta", "alta"]);
    expect(d.segmentos[0].intensidad).toBeGreaterThan(d.segmentos[1].intensidad);
  });

  it("con menos de tres puntos no hay escala", () => {
    expect(divergente(escala.slice(0, 2))).toBeNull();
  });
});

describe("tira de cifras (E5)", () => {
  it("con dist: responden, sin respuesta, más frecuente y opciones usadas", () => {
    const base = resolverBase({ ...UNI, filtros_aplicados: 0 }, DIST, FICHA);
    const cifras = cifrasClave(UNI, DIST, FICHA, base);
    expect(cifras.map((c) => c.rotulo)).toEqual(["Responden", "Sin respuesta", "Más frecuente", "Opciones usadas"]);
    expect(cifras[2]).toEqual({ rotulo: "Más frecuente", valor: "31.3%", nota: "Dependiente" });
    expect(cifras[3]).toEqual({ rotulo: "Opciones usadas", valor: "4 de 6", nota: "ningún caso fuera de lista" });
  });

  it("sin dist cae a las tarjetas del motor anterior", () => {
    const cifras = cifrasClave(UNI, null, null, resolverBase(UNI, null, null));
    expect(cifras.map((c) => c.rotulo)).toEqual(["Total casos", "Válidos", "Missing"]);
    expect(cifras[1]).toEqual({ rotulo: "Válidos", valor: "600", nota: "93.5% de la base" });
  });
});

describe("tabla de calor (E9)", () => {
  const tabla = {
    filas: [{ codigo: "1", etiqueta: "Dependiente" }, { codigo: "2", etiqueta: "Independiente" }],
    columnas: [{ codigo: "a", etiqueta: "Ate", n: 100 }, { codigo: "b", etiqueta: "Breña", n: 100 }],
    n: [[60, 40], [40, 60]],
  };

  it("por columna: cada columna suma 100, Total aparte, marca a 5 puntos", () => {
    const m = modeloCalor(tabla, "columna");
    expect(m.filas[0].celdas.map((c) => c.valor)).toEqual([60, 40]);
    expect(m.filas[0].total?.valor).toBe(50);
    expect(m.filas[0].celdas.map((c) => c.marca)).toEqual(["arriba", "abajo"]);
    expect(m.filaTotal).toBeNull();
    expect(m.filas[0].celdas[0].peso).toBe(1);
  });

  it("por fila: compara con la fila Total", () => {
    const m = modeloCalor({ ...tabla, n: [[52, 48], [48, 52]] }, "fila");
    expect(m.filas[0].celdas[0].valor).toBe(52);
    expect(m.filaTotal?.map((c) => c.valor)).toEqual([50, 50]);
    expect(m.filas[0].celdas[0].marca).toBeNull();
  });

  it("en n no hay comparación ni marcas", () => {
    const m = modeloCalor(tabla, "n");
    expect(m.filas.flatMap((f) => f.celdas.map((c) => c.marca))).toEqual([null, null, null, null]);
    expect(m.totalGeneral).toBe(200);
    expect(desviaciones(m)).toEqual([]);
  });

  it("una múltiple en columnas divide por el n de la columna, no por la suma de sus filas", () => {
    const sm = { ...tabla, columnas: [{ codigo: "a", etiqueta: "A", n: 80 }, { codigo: "b", etiqueta: "B", n: 100 }] };
    expect(modeloCalor(sm, "columna").filas[0].celdas[0].valor).toBe(75);
  });

  it("las mayores diferencias, de mayor a menor, con su lectura", () => {
    const d = desviaciones(modeloCalor(tabla, "columna"));
    expect(d).toHaveLength(3);
    expect(d[0].titulo).toBe("Ate: más «Dependiente»");
    expect(d[0].detalle).toBe("60.0% frente a 50.0% del total, 10.0 puntos por encima.");
    expect(rangoColumnas(modeloCalor(tabla, "columna"))).toEqual({ min: 100, max: 100 });
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
