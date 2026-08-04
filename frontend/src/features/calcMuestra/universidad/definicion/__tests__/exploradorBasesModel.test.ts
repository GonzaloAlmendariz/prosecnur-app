import { describe, expect, it } from "vitest";

import { distribucionDe, inventarioVariables } from "../exploradorBasesModel";
import type { MonitoreoRow } from "../../../../../api/client";

/**
 * G42 · El explorador describe la base leída, y sólo eso.
 *
 * Lo calculable de esta pestaña son tres decisiones que no se ven en pantalla:
 * qué cuenta como ausencia, qué es numérico y qué se agrupa en «otras». De las
 * tres, la que más engaña es la segunda: una bandera 0/1 descrita con media y
 * cuartiles responde a una pregunta que nadie hizo.
 */
const filas = [
  { modalidad: "PRESENCIAL", elegibles: 30, activo: 1, vacio: "" },
  { modalidad: "PRESENCIAL", elegibles: 10, activo: 0, vacio: "NA" },
  { modalidad: "VIRTUAL", elegibles: 20, activo: 1, vacio: null },
  { modalidad: "", elegibles: 40, activo: 1, vacio: "  " },
] as unknown as MonitoreoRow[];

describe("exploradorBasesModel · inventario", () => {
  it("clasifica numéricas y categóricas, y cuenta el dato real", () => {
    const inventario = inventarioVariables(filas);
    const porColumna = new Map(inventario.map((row) => [row.columna, row]));
    expect(porColumna.get("elegibles")?.tipo).toBe("numerica");
    expect(porColumna.get("modalidad")?.tipo).toBe("categorica");
    // Vacío, "NA" y espacios son ausencia: la columna entera se cae del inventario.
    expect(porColumna.has("vacio")).toBe(false);
    // Tres filas traen modalidad; la cuarta la tiene vacía.
    expect(porColumna.get("modalidad")?.conDato).toBe(3);
  });

  it("una bandera 0/1 no se describe como numérica", () => {
    const inventario = inventarioVariables(filas);
    expect(inventario.find((row) => row.columna === "activo")?.tipo).toBe("categorica");
  });

  it("no ofrece identificadores ni hashes", () => {
    const conIds = [
      { classroom_id: "A1", unique_student_hash: "x", modalidad: "PRESENCIAL" },
    ] as unknown as MonitoreoRow[];
    const columnas = inventarioVariables(conIds).map((row) => row.columna);
    expect(columnas).toEqual(["modalidad"]);
  });
});

describe("exploradorBasesModel · distribución", () => {
  it("la categórica reparte el dato y separa la ausencia", () => {
    const dist = distribucionDe(filas, "modalidad", "categorica");
    expect(dist?.tipo).toBe("categorica");
    if (dist?.tipo !== "categorica") return;
    expect(dist.conDato).toBe(3);
    expect(dist.sinDato).toBe(1);
    expect(dist.categorias[0]).toMatchObject({ clave: "PRESENCIAL", n: 2 });
    // Los shares son sobre lo que tiene dato, no sobre las filas totales: 2/3.
    expect(dist.categorias[0]?.share).toBeCloseTo(2 / 3, 5);
    expect(dist.categorias.reduce((acc, row) => acc + row.n, 0)).toBe(dist.conDato);
  });

  it("agrupa la cola en «otras» en vez de listar cien categorías", () => {
    const muchas = Array.from({ length: 40 }, (_, index) => ({
      cat: `C${index}`,
    })) as unknown as MonitoreoRow[];
    const dist = distribucionDe(muchas, "cat", "categorica");
    if (dist?.tipo !== "categorica") throw new Error("categorica esperada");
    expect(dist.categorias).toHaveLength(12);
    expect(dist.otras?.categorias).toBe(28);
    expect(dist.categorias.reduce((acc, row) => acc + row.n, 0) + (dist.otras?.n ?? 0))
      .toBe(dist.conDato);
  });

  it("la numérica publica cuantiles y un histograma que suma el total", () => {
    const dist = distribucionDe(filas, "elegibles", "numerica");
    if (dist?.tipo !== "numerica") throw new Error("numerica esperada");
    expect(dist.min).toBe(10);
    expect(dist.max).toBe(40);
    expect(dist.media).toBe(25);
    expect(dist.p50).toBe(25);
    expect(dist.bins.reduce((acc, bin) => acc + bin.n, 0)).toBe(dist.conDato);
  });

  it("sin filas no inventa distribución", () => {
    expect(distribucionDe([], "modalidad", "categorica")).toBeNull();
  });
});
