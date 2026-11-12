import { describe, expect, it } from "vitest";

import type { LimpiezaSummary } from "../types";
import {
  PENDIENTES_CIERRE,
  PENDIENTES_HALLAZGOS,
  cabeceraDeCierre,
  cabeceraDeExplorar,
  cabeceraDeHallazgos,
  cabeceraDeReglas,
  fechaCorta,
} from "./cabeceraDeValidacion";

// Rebanada V0 del plan de fidelidad: la cabecera dice solo lo inequívoco y
// declara lo que falta. Cada caso de abajo distingue un estado de su vecino.

function limpieza(cambios: Partial<LimpiezaSummary> & { auditada?: boolean; pendientes?: number }): LimpiezaSummary {
  const { auditada = true, pendientes = 0, ...resto } = cambios;
  return {
    ok: true,
    base_nombre: null,
    progreso: { plan_construido: true, auditoria_corrida: auditada, n_reglas_custom: 0 },
    summary: { pendientes } as LimpiezaSummary["summary"],
    kpis: [],
    top_reglas: null,
    top_variables: null,
    decision_queue: [],
    decision_draft: [],
    module_stats: {} as LimpiezaSummary["module_stats"],
    before_after_preview: null,
    artifacts: {},
    actions: [],
    ...resto,
  };
}

const CIFRAS = {
  n_hallazgos: 21, n_reglas_evaluadas: 97, n_reglas_con_casos: 5, n_casos_evaluados: 178,
  n_encuestados_con_hallazgos: 18, n_registros_sin_encuestado: 0, por_tabla: [],
};

describe("cabecera de Hallazgos", () => {
  it("mientras carga no afirma nada, pero declara lo que falta", () => {
    const c = cabeceraDeHallazgos(null);
    expect(c.estado).toBeNull();
    expect(c.cifras).toEqual([]);
    expect(c.pendientes).toBe(PENDIENTES_HALLAZGOS);
  });

  it("sin auditoría dice Sin auditar y no inventa cifras", () => {
    const c = cabeceraDeHallazgos(limpieza({ auditada: false }));
    expect(c.estado).toEqual({ tono: "parcial", texto: "Sin auditar" });
    expect(c.cifras).toEqual([]);
  });

  it("con hallazgos por decidir: casos con algún hallazgo sobre los casos auditados y reglas aplicadas", () => {
    const c = cabeceraDeHallazgos(limpieza({ pendientes: 5, cifras_hallazgos: CIFRAS }));
    expect(c.estado).toEqual({ tono: "parcial", texto: "Por decidir" });
    expect(c.cifras.map((x) => [x.valor, x.base ?? null, x.rotulo])).toEqual([
      ["18", "178", "casos con algún hallazgo"],
      ["97", null, "reglas aplicadas"],
    ]);
  });

  it("ninguna cifra cuenta hallazgos mientras D-F1 no esté decidida", () => {
    const c = cabeceraDeHallazgos(limpieza({ pendientes: 5, cifras_hallazgos: CIFRAS }));
    expect(c.cifras.some((x) => /hallazgos por decidir/.test(x.rotulo))).toBe(false);
    expect(c.cifras.some((x) => x.valor === "21")).toBe(false);
  });

  it("todo decidido no se lee como Por decidir", () => {
    const c = cabeceraDeHallazgos(limpieza({ pendientes: 0, cifras_hallazgos: CIFRAS }));
    expect(c.estado).toBeNull();
  });

  it("sin hallazgos: 0 hallazgos y las reglas aplicadas", () => {
    const c = cabeceraDeHallazgos(limpieza({ cifras_hallazgos: { ...CIFRAS, n_hallazgos: 0, n_encuestados_con_hallazgos: 0 } }));
    expect(c.estado).toEqual({ tono: "listo", texto: "Sin hallazgos" });
    expect(c.cifras.map((x) => `${x.valor} ${x.rotulo}`)).toEqual(["0 hallazgos", "97 reglas aplicadas"]);
  });

  it("sin reglas evaluadas no dice 0 casos con hallazgos", () => {
    const c = cabeceraDeHallazgos(limpieza({ cifras_hallazgos: { ...CIFRAS, n_hallazgos: 0, n_reglas_evaluadas: 0 } }));
    expect(c.estado).toEqual({ tono: "atencion", texto: "No hay reglas evaluadas" });
    expect(c.cifras).toEqual([]);
  });

  it("sin la base de los casos no hay cifra de casos, en vez de una sin denominador", () => {
    const c = cabeceraDeHallazgos(limpieza({ pendientes: 1, cifras_hallazgos: { ...CIFRAS, n_casos_evaluados: null } }));
    expect(c.cifras.map((x) => x.clave)).toEqual(["reglas-aplicadas"]);
  });

  it("concuerda con el número: 1 regla aplicada", () => {
    const c = cabeceraDeHallazgos(limpieza({ pendientes: 1, cifras_hallazgos: { ...CIFRAS, n_reglas_evaluadas: 1 } }));
    expect(c.cifras.at(-1)?.rotulo).toBe("regla aplicada");
  });

  it("un motor anterior sin cifras deja solo el estado", () => {
    const c = cabeceraDeHallazgos(limpieza({ pendientes: 2 }));
    expect(c.estado?.texto).toBe("Por decidir");
    expect(c.cifras).toEqual([]);
  });
});

describe("cabecera de Cierre", () => {
  it("cerrada: la fecha corta del cierre", () => {
    const c = cabeceraDeCierre(limpieza({ artifacts: { finalized_at: "2026-11-06T15:20:00", files: [] } }));
    expect(c.estado).toEqual({ tono: "listo", texto: "Cerrada el 6 nov" });
    expect(c.pendientes).toBe(PENDIENTES_CIERRE);
  });

  it("sin cerrar no dice nada", () => {
    expect(cabeceraDeCierre(limpieza({})).estado).toBeNull();
  });

  it("con la promoción revertida ya no se lee como cerrada", () => {
    const c = cabeceraDeCierre(limpieza({
      artifacts: {
        finalized_at: "2026-11-06T15:20:00",
        files: [],
        promocion: { enabled: false, source_data_file_id: "a", effective_data_file_id: "a", reverted_at: "2026-11-07T10:00:00" },
      },
    }));
    expect(c.estado).toBeNull();
  });
});

describe("Explorar y Reglas en V0", () => {
  it("no afirman cifras: las declaran pendientes", () => {
    for (const c of [cabeceraDeExplorar(), cabeceraDeReglas()]) {
      expect(c.estado).toBeNull();
      expect(c.cifras).toEqual([]);
      expect(c.pendientes.length).toBeGreaterThan(0);
    }
  });
});

describe("Explorar (V5)", () => {
  const DATOS = { preguntas: 63, casos: 178, casosTrasFiltro: 178, filtros: 0, cruce: false };
  const leer = (c: ReturnType<typeof cabeceraDeExplorar>) => c.cifras.map((x) => `${x.valor}${x.base ? `/${x.base}` : ""} ${x.rotulo}`);

  it("sin filtro ni cruce: preguntas y casos", () => {
    const c = cabeceraDeExplorar(DATOS);
    expect(leer(c)).toEqual(["63 preguntas", "178 casos"]);
    expect(c.estado).toBeNull();
  });

  it("con filtro y cruce: casos tras el filtro sobre el total, cruce y filtros activos", () => {
    expect(leer(cabeceraDeExplorar({ ...DATOS, casosTrasFiltro: 142, filtros: 1, cruce: true }))).toEqual([
      "63 preguntas", "142/178 casos tras el filtro", "1 cruce activo", "1 filtro activo",
    ]);
    expect(leer(cabeceraDeExplorar({ ...DATOS, casosTrasFiltro: 90, filtros: 2 }))).toContain("2 filtros activos");
  });

  it("sin la primera pregunta leída no cuenta casos (no los da por 0)", () => {
    expect(leer(cabeceraDeExplorar({ ...DATOS, casos: null, casosTrasFiltro: null }))).toEqual(["63 preguntas"]);
    expect(leer(cabeceraDeExplorar({ ...DATOS, preguntas: 1, casos: 1 }))).toEqual(["1 pregunta", "1 caso"]);
  });
});

describe("fecha corta", () => {
  it("día y mes abreviado, en castellano", () => {
    expect(fechaCorta("2026-09-03T12:00:00")).toBe("3 set");
    expect(fechaCorta("2026-11-08T12:00:00")).toBe("8 nov");
  });

  it("sin fecha legible no hay fecha", () => {
    expect(fechaCorta(null)).toBeNull();
    expect(fechaCorta("")).toBeNull();
    expect(fechaCorta("no es una fecha")).toBeNull();
  });
});
