import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiMailContactos,
  apiMailContactosControl,
  apiMailContactosEnlace,
  apiMailContactosPerfil,
  filtrosComoJson,
  normalizarEnlacesGenerados,
  normalizarPaginaDeContactos,
  normalizarPerfilDeContactos,
  queryDeContactos,
  queryDelPerfil,
} from "./mailContactos";

// Payloads de ejemplo con la forma del contrato congelado (ADR 0112 §4) y las
// mañas de jsonlite: vectores de largo uno como escalares, `{}` por lista vacía
// y `NA` como `null`.
const PAGINA = {
  total: 312,
  page: 2,
  per_page: 50,
  columnas: [{ key: "carrera", label: "Carrera" }, { key: "sexo", label: "Sexo" }, "sede"],
  rows: [
    {
      fila: 51,
      email: "ana@example.org",
      nombre: "Ana",
      estado: "efectivo",
      tiene_enlace: true,
      respondio: null,
      valores: { carrera: "Derecho", sexo: ["F"], sede: null },
    },
    { fila: 52, email: "", nombre: "Luis", estado: "sin_correo", tiene_enlace: false, respondio: false, valores: {} },
    { fila: 53, email: "x@", nombre: "Raro", estado: "otro_estado", tiene_enlace: "TRUE", respondio: "si", valores: [] },
  ],
  resumen: {
    importados: 320,
    efectivos: 312,
    sin_correo: 3,
    correo_invalido: 2,
    repetidos: 3,
    con_enlace: 0,
    respondieron: null,
    leido_en: null,
  },
};

const PERFIL = {
  base: 312,
  control: "carrera",
  candidatas: [
    { key: "carrera", label: "Carrera", distintos: 12, tipo: "categorica" },
    { key: "codigo", label: "Código", distintos: 312, tipo: "muchas" },
    { key: "carrera", label: "Duplicada", distintos: 1, tipo: "categorica" },
  ],
  variables: [
    {
      key: "carrera",
      label: "Carrera",
      categorias: [
        { valor: "Derecho", n: 200, pct: 64.1, respondieron: 50, tasa: 0.25 },
        { valor: ["Medicina"], n: 100, pct: 32.05, respondieron: null, tasa: null },
        { valor: null, n: 9, pct: 1 },
      ],
      sin_dato: { n: 12, pct: 3.85 },
    },
  ],
  cruce: { a: "carrera", b: "sexo", filas: ["Derecho", "Medicina"], columnas: "F", celdas: [[120], 60] },
  respuestas_leidas: false,
};

describe("normalizadores de contactos", () => {
  it("lee la página tal como la manda R", () => {
    const pagina = normalizarPaginaDeContactos(PAGINA);
    expect(pagina.total).toBe(312);
    expect(pagina.page).toBe(2);
    expect(pagina.columnas).toEqual([
      { key: "carrera", label: "Carrera" },
      { key: "sexo", label: "Sexo" },
      { key: "sede", label: "sede" },
    ]);
    expect(pagina.rows[0]).toEqual({
      fila: 51,
      email: "ana@example.org",
      nombre: "Ana",
      estado: "efectivo",
      tiene_enlace: true,
      respondio: null,
      valores: { carrera: "Derecho", sexo: "F", sede: null },
    });
    // Un estado que este cliente no conoce no se inventa.
    expect(pagina.rows[2].estado).toBeNull();
    expect(pagina.rows[2].tiene_enlace).toBe(true);
    expect(pagina.rows[2].respondio).toBe(true);
    expect(pagina.rows[2].valores).toEqual({});
    // «Sin leer» no es cero.
    expect(pagina.resumen.respondieron).toBeNull();
    expect(pagina.resumen.leido_en).toBeNull();
  });

  it("un cuerpo vacío o roto no revienta: devuelve una página vacía", () => {
    const pagina = normalizarPaginaDeContactos(null);
    expect(pagina).toMatchObject({ total: 0, page: 1, per_page: 50, rows: [], columnas: [] });
    expect(pagina.resumen.importados).toBe(0);
    expect(pagina.resumen.enlace_url).toBeNull();
  });

  it("el enlace del recopilador guardado y la columna del enlace marcada", () => {
    const pagina = normalizarPaginaDeContactos({
      columnas: [{ key: "sexo", label: "Sexo" }, { key: "enlace_encuesta", label: "Enlace", es_enlace: [true] }],
      resumen: { importados: 3, enlace_url: [" https://es.surveymonkey.com/r/ABC "] },
    });
    expect(pagina.resumen.enlace_url).toBe("https://es.surveymonkey.com/r/ABC");
    expect(pagina.columnas[0].es_enlace).toBeUndefined();
    expect(pagina.columnas[1].es_enlace).toBe(true);
    expect(normalizarPaginaDeContactos({ resumen: { enlace_url: "" } }).resumen.enlace_url).toBeNull();
  });

  it("lee el perfil: control escalar, candidatas únicas, categorías sin valor fuera", () => {
    const perfil = normalizarPerfilDeContactos(PERFIL);
    expect(perfil.control).toEqual(["carrera"]);
    expect(perfil.candidatas.map((c) => c.key)).toEqual(["carrera", "codigo"]);
    expect(perfil.candidatas[1].tipo).toBe("muchas");
    expect(perfil.variables[0].categorias.map((c) => c.valor)).toEqual(["Derecho", "Medicina"]);
    expect(perfil.variables[0].categorias[1].respondieron).toBeNull();
    expect(perfil.variables[0].sin_dato).toEqual({ n: 12, pct: 3.85, respondieron: null, tasa: null });
    expect(perfil.respuestas_leidas).toBe(false);
  });

  it("`cargados: false` llega sin lista y sin error: es el vacío de importar", () => {
    const pagina = normalizarPaginaDeContactos({ ok: true, campaign_id: "egresados", cargados: false, total: 0, rows: [], columnas: [], resumen: {} });
    expect(pagina.cargados).toBe(false);
    expect(normalizarPaginaDeContactos(PAGINA).cargados).toBe(true);
    expect(normalizarPerfilDeContactos({ cargados: false, cruce: null }).cargados).toBe(false);
  });

  it("«Otros», el enlace por categoría y el sin dato con su respuesta", () => {
    const perfil = normalizarPerfilDeContactos({
      ...PERFIL,
      variables: [{
        key: "carrera", label: "Carrera",
        categorias: [{ valor: "Otros", n: 9, pct: 2.9, respondieron: 1, tasa: 11.1, con_enlace: 9, otros: true }],
        sin_dato: { n: 3, pct: 1, respondieron: 1, tasa: 33.3 },
      }],
    });
    expect(perfil.variables[0].categorias[0]).toMatchObject({ otros: true, con_enlace: 9, tasa: 11.1 });
    expect(perfil.variables[0].sin_dato).toEqual({ n: 3, pct: 1, respondieron: 1, tasa: 33.3 });
  });

  it("el perfil trae el enlace guardado y los rótulos del cruce", () => {
    const perfil = normalizarPerfilDeContactos({
      ...PERFIL,
      enlace_url: "https://es.surveymonkey.com/r/ABC",
      cruce: { ...PERFIL.cruce, a_label: ["Carrera profesional"], b_label: "Sexo" },
    });
    expect(perfil.enlace_url).toBe("https://es.surveymonkey.com/r/ABC");
    expect(perfil.cruce).toMatchObject({ a_label: "Carrera profesional", b_label: "Sexo" });
    expect(normalizarPerfilDeContactos(PERFIL).enlace_url).toBeNull();
    expect(normalizarPerfilDeContactos(PERFIL).cruce?.a_label).toBeUndefined();
  });

  it("en el cruce, el `null` del final se rotula «Sin dato»", () => {
    const perfil = normalizarPerfilDeContactos({
      ...PERFIL, cruce: { a: "carrera", b: "sexo", filas: ["Derecho", null], columnas: ["F", null], celdas: [[1, 2], [3, 4]] },
    });
    expect(perfil.cruce?.filas).toEqual(["Derecho", "Sin dato"]);
    expect(perfil.cruce?.columnas).toEqual(["F", "Sin dato"]);
  });

  it("el cruce se ajusta al tamaño que declaran filas y columnas", () => {
    const perfil = normalizarPerfilDeContactos(PERFIL);
    expect(perfil.cruce).toEqual({ a: "carrera", b: "sexo", filas: ["Derecho", "Medicina"], columnas: ["F"], celdas: [[120], [60]] });
    expect(normalizarPerfilDeContactos({ ...PERFIL, cruce: {} }).cruce).toBeNull();
  });

  it("el resultado de generar enlaces completa el total si falta", () => {
    expect(normalizarEnlacesGenerados({ generados: 5, conservados: 307 })).toEqual({
      generados: 5, conservados: 307, total: 312, campo: "enlace_encuesta", url: "", aviso: null, mapeado: [],
      // Sin variable declarada, el enlace usa `t` (la de siempre).
      variable: "t",
    });
    expect(normalizarEnlacesGenerados({
      ok: true, generados: 1, conservados: 0, total: 1, campo: "enlace_encuesta", label: "Enlace a la encuesta",
      url: "https://example.org/x", aviso: ["El enlace no parece de SurveyMonkey."], mapeado: "button",
    })).toMatchObject({ aviso: "El enlace no parece de SurveyMonkey.", mapeado: ["button"], url: "https://example.org/x" });
  });
});

describe("consultas", () => {
  it("los filtros viajan como JSON estable y sin columnas vacías", () => {
    expect(filtrosComoJson({ sexo: ["F"], carrera: ["Derecho", "Derecho", "Medicina"], sede: [] }))
      .toBe('{"carrera":["Derecho","Medicina"],"sexo":["F"]}');
    expect(filtrosComoJson({ sede: [] })).toBeNull();
  });

  it("la lista lleva campaña, estado, respuesta y página; la búsqueda solo si hay", () => {
    const q = new URLSearchParams(queryDeContactos({ campaignId: "egresados", q: "  ", page: 3 }));
    expect(Object.fromEntries(q)).toEqual({ campaign_id: "egresados", estado: "todos", respondio: "todos", page: "3", per_page: "50" });
  });

  it("el perfil pide el cruce solo con dos variables distintas", () => {
    expect(queryDelPerfil({ campaignId: "c", cruce: ["a", "a"] })).toBe("campaign_id=c");
    expect(new URLSearchParams(queryDelPerfil({ campaignId: "c", cruce: ["a", "b"] })).get("cruce")).toBe("a,b");
  });
});

describe("llamadas", () => {
  const fetchMock = vi.fn();
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  function responder(body: unknown) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-test"), setItem: vi.fn(), removeItem: vi.fn() });
  }

  it("GET mail-contacts y mail-contacts/perfil", async () => {
    responder(PAGINA);
    const pagina = await apiMailContactos({ campaignId: "egresados", filtros: { carrera: ["Derecho"] } });
    expect(pagina.total).toBe(312);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/recopiladores/mail-contacts?");
    expect(new URL(url, "http://x").searchParams.get("filtros")).toBe('{"carrera":["Derecho"]}');

    responder(PERFIL);
    const perfil = await apiMailContactosPerfil({ campaignId: "egresados", cruce: ["carrera", "sexo"] });
    expect(perfil.base).toBe(312);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/api/recopiladores/mail-contacts/perfil?");
  });

  it("PUT control y enlace con campaign_id en el cuerpo", async () => {
    responder({ control: ["carrera", "sexo"] });
    expect(await apiMailContactosControl("egresados", ["carrera", "sexo"])).toEqual(["carrera", "sexo"]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ campaign_id: "egresados", variables: ["carrera", "sexo"] });

    responder({ generados: 5, conservados: 307, total: 312, campo: "enlace_encuesta", variable: "id" });
    const enlaces = await apiMailContactosEnlace("egresados", "https://es.surveymonkey.com/r/ABC", "id");
    expect(enlaces.total).toBe(312);
    expect(enlaces.variable).toBe("id");
    const [url, init2] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toContain("/api/recopiladores/mail-contacts/enlace");
    expect(JSON.parse(String(init2.body))).toEqual({ campaign_id: "egresados", url: "https://es.surveymonkey.com/r/ABC", variable: "id" });

    // Sin variable en la respuesta (backend anterior) se lee `t`.
    responder({ generados: 1, conservados: 0, total: 1, campo: "enlace_encuesta" });
    expect((await apiMailContactosEnlace("egresados", "https://es.surveymonkey.com/r/ABC", "t")).variable).toBe("t");
  });
});
