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

/**
 * **El denominador es el plan, no lo que cupo en la respuesta.**
 *
 * Medido en pantalla el 2026-08-25 sobre el recorrido de 400 titulares: el pie
 * decía «Mostrando 400 de 500 filas» y el plan tenía 3.409. Ese 500 no es
 * ningún total del proyecto — es `MONITOREO_AULAS_COURSE_STATUS_TOPE`, el tope
 * del payload. El lector concluye que faltan 100 aulas y faltan 3.009.
 *
 * El segundo caso es el que no se ve y el peor: cuando el servidor manda MENOS
 * filas que el tope local, no hay recorte local, y la tabla no rotulaba nada.
 * El truncado desaparecía en silencio, que es justo lo que esta función existe
 * para impedir.
 */
describe("recorteTabla con el total real del motor", () => {
  it("divide por el plan y no por el payload topeado", () => {
    const payload = Array.from({ length: 500 }, (_, i) => i);
    const recorte = recorteTabla(payload, 400, "fila", 3409);
    expect(recorte.etiqueta).toBe("Mostrando 400 de 3,409 filas");
    expect(recorte.total).toBe(3409);
  });

  it("declara el recorte del servidor aunque no haya recorte local", () => {
    const payload = Array.from({ length: 300 }, (_, i) => i);
    const recorte = recorteTabla(payload, 400, "fila", 3409);
    expect(recorte.recortado).toBe(true);
    expect(recorte.etiqueta).toBe("Mostrando 300 de 3,409 filas");
  });

  it("sin recorte del servidor se comporta igual que antes", () => {
    const payload = Array.from({ length: 300 }, (_, i) => i);
    expect(recorteTabla(payload, 400, "fila", 300).etiqueta).toBe("");
    expect(recorteTabla(payload, 400, "fila").recortado).toBe(false);
  });

  it("un total menor que las filas recibidas no encoge el denominador", () => {
    // Defensivo: si el motor mandara un total incoherente, el pie no puede
    // prometer menos filas de las que ya tiene en la mano.
    const payload = Array.from({ length: 500 }, (_, i) => i);
    expect(recorteTabla(payload, 400, "fila", 12).etiqueta).toBe("Mostrando 400 de 500 filas");
  });
});

describe("el bloqueo del corte incompleto dice CUÁL de los tres estados es", () => {
  /**
   * Un mensaje único —«incompleto o desactualizado»— cubría `partial`, `stale`
   * y `failed`, que piden cosas distintas: en `partial` la sincronización
   * terminó con errores y repetirla puede no arreglar nada, mientras que en
   * `stale` basta con volver a sincronizar. El sistema tiene el estado exacto,
   * así que la disyunción era pérdida de información, no cautela.
   *
   * Visto en la pestaña Salidas del perfil de cursos-horario, a 1440.
   */
  const mensaje = (generationStatus: string) =>
    readinessDeSalidas(construirCorte({
      ingesta: 1400, procesable: 1300, oficial: 1283, meta: 1200,
      hasSnapshot: true, generationStatus,
    })).bloqueos.find((b) => b.codigo === "CORTE_INCOMPLETO")?.mensaje ?? "";

  it("«partial» nombra los errores de la sincronización", () => {
    expect(mensaje("partial")).toContain("terminó con errores");
    expect(mensaje("partial")).not.toContain(" o desactualizado");
  });

  it("«stale» dice que quedó viejo, que es lo que se arregla sincronizando", () => {
    expect(mensaje("stale")).toContain("desactualizado");
    expect(mensaje("stale")).not.toContain("errores");
  });

  it("«failed» no se disfraza de corte incompleto", () => {
    expect(mensaje("failed")).toContain("falló");
  });

  it("un estado desconocido nombra el valor en vez de inventarle una causa", () => {
    // Sin esto, un estado nuevo del backend caería en la rama de otro y el
    // aviso afirmaría una causa que nadie comprobó.
    const texto = mensaje("reindexing");
    expect(texto).toContain("reindexing");
    expect(texto).not.toContain("errores");
    expect(texto).not.toContain("falló");
  });

  it("los tres mensajes conocidos son distintos entre sí", () => {
    const todos = ["partial", "stale", "failed"].map(mensaje);
    expect(new Set(todos).size).toBe(3);
    expect(todos.every((t) => t.length > 0)).toBe(true);
  });
});

describe("el estado vacío no se disfraza de sincronización fallida", () => {
  it("sin generation_status, el corte queda bloqueado pero el mensaje no inventa errores", () => {
    // Medido en vivo (2026-09-03, pre-campo): sync_errors vacío y ninguna
    // generación corrida, y la banda decía «la última sincronización terminó
    // con errores» — el colapso ""→"partial" fabricaba la historia.
    const corte = construirCorte({ ingesta: 0, procesable: 0, oficial: 0, meta: 2500 });
    expect(corte.generationStatus).toBe("");
    const r = readinessDeSalidas(corte);
    expect(r.bloqueos.length).toBeGreaterThan(0);
    const textos = r.bloqueos.map((b) => b.mensaje ?? "").join(" ");
    expect(textos).not.toContain("terminó con errores");
  });

  it("con partial declarado de verdad, el mensaje sí nombra los errores", () => {
    const corte = construirCorte({ ingesta: 10, procesable: 8, oficial: 5, meta: 2500, generationStatus: "partial" });
    const r = readinessDeSalidas(corte);
    const textos = r.bloqueos.map((b) => b.mensaje ?? "").join(" ");
    expect(textos).toContain("terminó con errores");
  });
});
