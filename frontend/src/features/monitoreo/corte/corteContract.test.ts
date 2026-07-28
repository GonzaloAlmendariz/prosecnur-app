import { describe, expect, it } from "vitest";
import {
  construirCorte,
  esTonoExito,
  estadoVisual,
  readinessDeSalidas,
  recorteTabla,
  textoAvance,
  textoSobrecumplimiento,
} from "./corteContract";

describe("construirCorte", () => {
  it("explica el salto de ingesta a procesable y de procesable a oficial", () => {
    // El caso real de la auditoría: 36 recibidas, 22 pasan filtro, 0 válidas.
    const corte = construirCorte({
      ingesta: 36,
      procesable: 22,
      oficial: 0,
      meta: 24,
      hasSnapshot: true,
      generationStatus: "complete",
    });

    expect(corte.saltos).toHaveLength(2);
    expect(corte.saltos[0]).toMatchObject({ de: "ingesta", a: "procesable", descartados: 14 });
    expect(corte.saltos[1]).toMatchObject({ de: "procesable", a: "oficial", descartados: 22 });
  });

  it("no inventa avance cuando el oficial no está determinado", () => {
    const corte = construirCorte({ ingesta: 36, meta: 24, hasSnapshot: true });
    expect(corte.oficial).toBeNull();
    expect(corte.avancePct).toBeNull();
    expect(corte.brecha).toBeNull();
  });

  it("no calcula porcentaje sin meta", () => {
    const corte = construirCorte({ ingesta: 10, oficial: 8, hasSnapshot: true });
    expect(corte.avancePct).toBeNull();
  });

  it("deja pasar el sobre-cumplimiento en vez de recortarlo en silencio", () => {
    const corte = construirCorte({ ingesta: 1400, oficial: 1283, meta: 1200, hasSnapshot: true });
    expect(corte.avancePct).toBeCloseTo(106.92, 1);
    expect(corte.brecha).toBe(0);
    expect(textoSobrecumplimiento(corte.oficial, corte.meta)).toBe("Meta superada, +83");
  });

  it("no habla de sobre-cumplimiento cuando no lo hay", () => {
    expect(textoSobrecumplimiento(900, 1200)).toBe("");
    expect(textoSobrecumplimiento(1200, 1200)).toBe("");
    expect(textoSobrecumplimiento(500, null)).toBe("");
    expect(textoSobrecumplimiento(null, 1200)).toBe("");
  });
});

describe("readinessDeSalidas", () => {
  const completo = {
    ingesta: 1400,
    procesable: 1300,
    oficial: 1283,
    meta: 1200,
    hasSnapshot: true,
    generationStatus: "complete" as const,
  };

  it("habilita la salida de cliente solo con corte completo y válidas", () => {
    const readiness = readinessDeSalidas(construirCorte(completo));
    expect(readiness.puedePublicarCliente).toBe(true);
    expect(readiness.bloqueos).toEqual([]);
    expect(readiness.estado).toBe("listo");
  });

  it("bloquea con cero válidas aunque el snapshot tenga filas", () => {
    // Este es el P1 de la auditoría: 36 filas crudas bastaban para emitir el PDF.
    const readiness = readinessDeSalidas(construirCorte({ ...completo, oficial: 0 }));
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.bloqueos.map((b) => b.codigo)).toContain("SIN_VALIDAS");
    expect(readiness.estado).toBe("bloqueado");
  });

  it("bloquea cuando las efectivas están sin determinar", () => {
    const readiness = readinessDeSalidas(construirCorte({ ...completo, oficial: null }));
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.bloqueos.map((b) => b.codigo)).toContain("OFICIAL_INDETERMINADO");
    expect(readiness.estado).toBe("no-evaluado");
  });

  it("bloquea cuando el corte no está completo", () => {
    const readiness = readinessDeSalidas(construirCorte({ ...completo, generationStatus: "partial" }));
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.bloqueos.map((b) => b.codigo)).toContain("CORTE_INCOMPLETO");
  });

  it("sin snapshot pide sincronizar antes que nada", () => {
    const readiness = readinessDeSalidas(construirCorte({ ingesta: 0, hasSnapshot: false }));
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.bloqueos.map((b) => b.codigo)).toEqual(["SIN_CORTE"]);
    expect(readiness.estado).toBe("sin-configurar");
  });

  it("cada bloqueo lleva una dirección para llegar a la causa", () => {
    const readiness = readinessDeSalidas(construirCorte({ ...completo, oficial: 0, generationStatus: "stale" }));
    expect(readiness.bloqueos.length).toBeGreaterThan(0);
    for (const bloqueo of readiness.bloqueos) {
      expect(bloqueo.direccion, `bloqueo ${bloqueo.codigo} sin dirección`).toBeTruthy();
    }
  });
});

describe("estadoVisual", () => {
  it("solo devuelve listo con evidencia completa", () => {
    expect(estadoVisual({ configurado: true, evaluado: true, completo: true })).toBe("listo");
  });

  it("tener filas no alcanza para estar listo", () => {
    // El viejo readyStatus() devolvía "ready" con solo existir actores.
    expect(estadoVisual({ configurado: true, evaluado: true, completo: false })).toBe("parcial");
  });

  it("distingue sin configurar de no evaluado", () => {
    expect(estadoVisual({ configurado: false })).toBe("sin-configurar");
    expect(estadoVisual({ configurado: true, evaluado: false })).toBe("no-evaluado");
  });

  it("un prerrequisito ausente gana sobre el resto", () => {
    expect(estadoVisual({ configurado: true, evaluado: true, completo: true, bloqueado: true })).toBe("bloqueado");
  });

  it("el verde es exclusivo de listo", () => {
    const estados = ["sin-configurar", "no-evaluado", "parcial", "bloqueado", "listo"] as const;
    expect(estados.filter(esTonoExito)).toEqual(["listo"]);
  });
});

describe("recorteTabla", () => {
  const rows = Array.from({ length: 120 }, (_, i) => i);

  it("declara el recorte con N de M", () => {
    const recorte = recorteTabla(rows, 80);
    expect(recorte.recortado).toBe(true);
    expect(recorte.visibles).toHaveLength(80);
    expect(recorte.etiqueta).toBe("Mostrando 80 de 120 filas");
  });

  it("no rotula cuando muestra todo", () => {
    const recorte = recorteTabla(rows.slice(0, 10), 80);
    expect(recorte.recortado).toBe(false);
    expect(recorte.etiqueta).toBe("");
  });

  it("cuenta columnas cuando corresponde", () => {
    const columnas = Array.from({ length: 9 }, (_, i) => `col-${i}`);
    expect(recorteTabla(columnas, 8, "columna").etiqueta).toBe("Mostrando 8 de 9 columnas");
  });
});

describe("textoAvance", () => {
  it("nunca muestra un número sin denominador", () => {
    expect(textoAvance(1283, 1200)).toBe("1,283 de 1,200");
    expect(textoAvance(8, null)).toBe("8 sin meta declarada");
    expect(textoAvance(null, 1200)).toBe("S/D");
  });
});
