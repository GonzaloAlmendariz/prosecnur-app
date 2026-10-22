import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cuerpoGuardarCuotas,
  getMonitoreoCuotas,
  normalizeMonitoreoCuotaPropuesta,
  normalizeMonitoreoCuotasEstado,
  postMonitoreoCuotaProponer,
  postMonitoreoCuotas,
} from "./monitoreoCuotas";

// Forma exacta del contrato T2 (docs/qa/checklist-monitoreo-cuotas-y-revamp-correo-2026-10-22.md).
const ESTADO = {
  ok: true,
  avisos: [],
  publicos: [{
    actor: "Docentes Campus", universo: 2599, efectivas: 481, meta: 811,
    variables: [
      { variable: "Dedicación", categorias: 3 },
      { variable: "Categoría", categorias: 4 },
      { variable: "Departamento académico", categorias: 15 },
    ],
  }],
  cuotas: [{
    id: "q1", actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312, universo: 2599, meta: 812,
    efectivas: 481, avance: 0.592, categorias_cumplidas: 0, categorias_total: 3, sin_dato: 0,
    categorias: [
      { categoria: "TPA", universo: 1939, meta: 605, efectivas: 350, falta: 255, avance: 0.578, tasa: 0.18, estado: "en_curso" },
      { categoria: "DTC", universo: 631, meta: 197, efectivas: 125, falta: 72, avance: 0.634, tasa: 0.198, estado: "en_curso" },
      { categoria: "TPC20", universo: 29, meta: 10, efectivas: 6, falta: 4, avance: 0.6, tasa: 0.207, estado: "en_curso" },
    ],
  }],
};

describe("normalizeMonitoreoCuotasEstado", () => {
  it("conserva la forma del contrato", () => {
    const e = normalizeMonitoreoCuotasEstado(ESTADO);
    expect(e.publicos[0]).toMatchObject({ actor: "Docentes Campus", universo: 2599, meta: 811 });
    expect(e.publicos[0].variables.map((v) => v.variable)).toEqual(["Dedicación", "Categoría", "Departamento académico"]);
    expect(e.cuotas[0]).toMatchObject({ id: "q1", cobertura: 0.312, meta: 812, categorias_total: 3 });
    expect(e.cuotas[0].categorias[0]).toEqual({
      categoria: "TPA", universo: 1939, meta: 605, efectivas: 350, falta: 255, avance: 0.578, tasa: 0.18, estado: "en_curso",
    });
  });

  it("acepta auto_unbox: listas de uno sueltas, escalares en arreglo, {} por NULL y NA como null", () => {
    const e = normalizeMonitoreoCuotasEstado({
      ok: [true],
      avisos: "Monitoreo todavía no tiene el universo cargado: sincroniza las fuentes.",
      publicos: { actor: ["Pregrado"], universo: [100], efectivas: [3], meta: null, variables: { variable: "Unidad", categorias: [15] } },
      cuotas: {
        id: "q2", actor: "Pregrado", variable: "Unidad", cobertura: null, universo: 100, meta: 30, efectivas: 3,
        avance: null, categorias_cumplidas: 0, categorias_total: 1, sin_dato: {},
        categorias: { categoria: "Letras", universo: 100, meta: 30, efectivas: 3, falta: 27, avance: 0.1, tasa: 0.03, estado: ["en_curso"] },
      },
    });
    expect(e.avisos).toHaveLength(1);
    expect(e.publicos[0]).toMatchObject({ actor: "Pregrado", meta: null });
    expect(e.publicos[0].variables).toEqual([{ variable: "Unidad", categorias: 15 }]);
    expect(e.cuotas[0]).toMatchObject({ cobertura: null, avance: null, sin_dato: null });
    expect(e.cuotas[0].categorias[0].estado).toBe("en_curso");
  });

  it("una respuesta vacía no rompe: sin públicos ni cuotas", () => {
    expect(normalizeMonitoreoCuotasEstado({})).toEqual({ ok: true, preparando: false, publicos: [], cuotas: [], avisos: [] });
    expect(normalizeMonitoreoCuotasEstado({ preparando: "TRUE" }).preparando).toBe(true);
    expect(normalizeMonitoreoCuotasEstado(null).cuotas).toEqual([]);
  });

  it("un estado desconocido se deduce de las cifras, no cae en «sin meta»", () => {
    const e = normalizeMonitoreoCuotasEstado({
      cuotas: [{
        id: "q", actor: "A", variable: "V",
        categorias: [
          { categoria: "x", meta: 10, efectivas: 12, estado: "raro" },
          { categoria: "y", meta: 10, efectivas: 0 },
          { categoria: "z", meta: 0, efectivas: 4 },
          { categoria: "w", meta: 10, efectivas: 4 },
        ],
      }],
    });
    expect(e.cuotas[0].categorias.map((c) => c.estado)).toEqual(["cumplida", "sin_avance", "sin_meta", "en_curso"]);
  });
});

describe("propuesta y cuerpo del guardado", () => {
  it("normaliza la propuesta y admite cobertura nula", () => {
    const p = normalizeMonitoreoCuotaPropuesta({
      ok: true, actor: "Docentes Campus", variable: "Dedicación", cobertura: null,
      categorias: { categoria: "TPA", universo: 1939, meta: 0 },
    });
    expect(p).toEqual({
      actor: "Docentes Campus", variable: "Dedicación", cobertura: null,
      categorias: [{ categoria: "TPA", universo: 1939, meta: 0 }],
    });
  });

  it("el cuerpo redondea metas, descarta negativas y no manda una cobertura inválida", () => {
    const body = cuerpoGuardarCuotas([
      { id: "q1", actor: "A", variable: "V", cobertura: 0.312, metas: { TPA: 605.4, DTC: -3, X: Number.NaN } },
      { actor: "B", variable: "W", cobertura: 1.5, metas: {} },
    ]);
    expect(body.cuotas[0]).toEqual({ id: "q1", actor: "A", variable: "V", cobertura: 0.312, metas: { TPA: 605, DTC: 0, X: 0 } });
    expect(body.cuotas[1]).toEqual({ actor: "B", variable: "W", cobertura: null, metas: {} });
  });
});

describe("rutas", () => {
  const fetchMock = vi.fn();
  const responde = (body: unknown) => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-test"), setItem: vi.fn(), removeItem: vi.fn() });
  };
  afterEach(() => { vi.unstubAllGlobals(); });

  it("GET estado", async () => {
    responde(ESTADO);
    const e = await getMonitoreoCuotas();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/monitoreo/cuotas");
    expect(e.cuotas).toHaveLength(1);
  });

  it("POST proponer manda la cobertura solo si es válida", async () => {
    responde({ ok: true, actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312, categorias: [{ categoria: "TPA", universo: 1939, meta: 605 }] });
    const p = await postMonitoreoCuotaProponer({ actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/monitoreo/cuotas/proponer");
    expect(JSON.parse(String(init.body))).toEqual({ actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312 });
    expect(p.categorias[0].meta).toBe(605);

    responde({ ok: true, actor: "A", variable: "V", cobertura: 0.2, categorias: [] });
    await postMonitoreoCuotaProponer({ actor: "A", variable: "V", cobertura: null });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ actor: "A", variable: "V" });
  });

  it("POST guardar reemplaza la configuración y devuelve el estado", async () => {
    responde(ESTADO);
    const e = await postMonitoreoCuotas([{ id: "q1", actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312, metas: { TPA: 605 } }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/monitoreo\/cuotas$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).cuotas[0].metas).toEqual({ TPA: 605 });
    expect(e.cuotas[0].id).toBe("q1");
  });
});
