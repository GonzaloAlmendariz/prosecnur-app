import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiCargaArmonizacionBase,
  apiCargaCompararFuentes,
  normalizeArmonizacionBase,
  normalizeComparacionFuentes,
} from "./cargaArmonizacion";

const fetchMock = vi.hoisted(() => vi.fn<(input: string, init?: RequestInit) => Promise<Response>>());

vi.mock("./core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./core")>()),
  apiFetch: fetchMock,
  headers: (extra: Record<string, string> = {}) => extra,
  handle: async (res: Response) => res.json(),
}));

function responde(body: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
}

beforeEach(() => fetchMock.mockReset());

// Forma en que R serializa: escalares de largo uno, lista de uno como objeto suelto, NULL como {}.
const ARMONIZACION_R = {
  ok: [true],
  base: ["estudiantes_sm"],
  disponible: [true],
  formulario: { form_id: ["f1"], form_name: ["Estudiantes Arte 2026"], revision_id: ["rev-3"], revision_no: [3] },
  fuente: ["surveymonkey"],
  importado_at: ["2026-10-12T15:04:00Z"],
  n_filas: [289],
  fuentes: {},
  n_emparejadas: [38],
  n_variables_instrumento: [42],
  cobertura: [0.905],
  sin_par_instrumento: { variable: ["p40"], etiqueta: ["Comentario final"] },
  sin_par_fuente: [],
  agregadas_fuente: [],
  recodificaciones: [{ variable: ["p10"], etiqueta: ["SIN INF"], desde: [5], hacia: [99] }],
  opciones_sin_par: { variable: ["p3"], n: [3], etiquetas: { etiqueta: ["No binario"], n: [3] } },
};

describe("normalizeArmonizacionBase", () => {
  it("lee la armonización guardada en la forma de R y la deja lista para la vista previa", () => {
    const a = normalizeArmonizacionBase(ARMONIZACION_R);
    expect(a.base).toBe("estudiantes_sm");
    expect(a.disponible).toBe(true);
    expect(a.formulario).toEqual({ form_id: "f1", form_name: "Estudiantes Arte 2026", revision_id: "rev-3", revision_no: 3 });
    expect(a.fuente).toBe("surveymonkey");
    expect(a.detalle.n_filas).toBe(289);
    expect(a.detalle.cobertura).toBeCloseTo(0.905);
    expect(a.detalle.sin_par_instrumento).toEqual([{ variable: "p40", etiqueta: "Comentario final" }]);
    expect(a.detalle.recodificaciones).toEqual([{ variable: "p10", etiqueta: "SIN INF", desde: "5", hacia: "99" }]);
    expect(a.detalle.opciones_sin_par).toEqual([{ variable: "p3", n: 3, etiquetas: [{ etiqueta: "No binario", n: 3 }] }]);
    expect(a.detalle.bloqueo).toBeNull();
  });

  it("disponible:false con formulario NULL ({}) queda como vacío honesto, sin inventar datos", () => {
    const a = normalizeArmonizacionBase({ ok: [true], base: ["vieja"], disponible: [false], formulario: {} });
    expect(a.disponible).toBe(false);
    expect(a.formulario).toBeNull();
    expect(a.detalle.recodificaciones).toEqual([]);
  });

  it("usa la base pedida si el backend no la devuelve", () => {
    expect(normalizeArmonizacionBase({}, "docentes").base).toBe("docentes");
  });
});

const COMPARACION_R = {
  ok: [true],
  base_a: { nombre: ["estudiantes_sm"], n_filas: [289], fuente: ["surveymonkey"], datos: ["cruda"] },
  base_b: { nombre: ["estudiantes_sav"], n_filas: [279], fuente: ["sav"], datos: ["depurada"] },
  revision_id: ["rev-3"],
  n_variables: [3],
  variables: [
    {
      variable: ["p1"], etiqueta: ["Facultad"], tipo: ["select_one"], estado: ["igual"],
      n_validos_a: [289], n_validos_b: [279],
      categorias: { codigo: [1], etiqueta: ["Arte"], n_a: [289], n_b: [279], pct_a: [100], pct_b: [100], especial: [false], fuera_de_lista: [false] },
      diferencia_max_pp: [0], categorias_solo_a: [], categorias_solo_b: {},
    },
    {
      variable: ["p3"], etiqueta: ["Género"], tipo: ["select_one"], estado: ["distinta"],
      n_validos_a: [289], n_validos_b: [276],
      categorias: [
        { codigo: [1], etiqueta: ["Mujer"], n_a: [150], n_b: [150], pct_a: [51.9], pct_b: [54.3] },
        { codigo: [3], etiqueta: ["No binario"], n_a: [3], n_b: {}, pct_a: [1], pct_b: {}, fuera_de_lista: [true] },
        { codigo: [99], etiqueta: ["SIN INF"], n_a: [10] , n_b: [6], especial: [true] },
      ],
      diferencia_max_pp: [-2.4],
      categorias_solo_a: ["3"],
      categorias_solo_b: [],
    },
    { variable: ["p9"], estado: ["raro"], categorias: {} },
  ],
  resumen: { n_iguales: [1], n_distintas: [1], n_con_categorias_exclusivas: [1], diferencia_filas: [10] },
  casos: { clave: ["respondent_id"], solo_a: [10], solo_b: [0], en_ambas: [279] },
  perdidas_en_carga_a: [],
  perdidas_en_carga_b: { variable: ["p3"], etiqueta: ["No binario"], n: [3] },
};

describe("normalizeComparacionFuentes", () => {
  const c = normalizeComparacionFuentes(COMPARACION_R);

  it("lee las dos fuentes con su tipo y si vienen crudas o depuradas", () => {
    expect(c.base_a).toEqual({ nombre: "estudiantes_sm", n_filas: 289, fuente: "surveymonkey", datos: "cruda" });
    expect(c.base_b.datos).toBe("depurada");
    expect(c.revision_id).toBe("rev-3");
  });

  it("acepta una lista de uno como objeto suelto y NULL como {}", () => {
    expect(c.variables[0].categorias).toHaveLength(1);
    expect(c.variables[0].categorias_solo_b).toEqual([]);
    expect(c.variables[2].categorias).toEqual([]);
  });

  it("marca especiales y fuera de lista, y deriva el % que falta desde n y válidos", () => {
    const [mujer, noBinario, sinInf] = c.variables[1].categorias;
    expect(mujer).toMatchObject({ codigo: "1", pct_a: 51.9, especial: false, fuera_de_lista: false });
    expect(noBinario).toMatchObject({ n_b: null, pct_b: null, fuera_de_lista: true });
    expect(sinInf.especial).toBe(true);
    expect(sinInf.pct_a).toBeCloseTo((10 / 289) * 100);
  });

  it("la diferencia máxima va en valor absoluto y un estado desconocido no se esconde entre las iguales", () => {
    expect(c.variables[1].diferencia_max_pp).toBe(2.4);
    expect(c.variables[2].estado).toBe("distinta");
  });

  it("categorías exclusivas aceptan códigos sueltos", () => {
    expect(c.variables[1].categorias_solo_a).toEqual([{ codigo: "3", etiqueta: "" }]);
  });

  it("lee casos, resumen y pérdidas en carga", () => {
    expect(c.casos).toEqual({ clave: "respondent_id", solo_a: 10, solo_b: 0, en_ambas: 279 });
    expect(c.resumen).toEqual({ n_iguales: 1, n_distintas: 1, n_con_categorias_exclusivas: 1, diferencia_filas: 10 });
    expect(c.perdidas_en_carga_a).toEqual([]);
    expect(c.perdidas_en_carga_b).toEqual([{ variable: "p3", etiqueta: "No binario", n: 3 }]);
  });

  it("sin clave común no hay casos; sin resumen, lo cuenta de las variables", () => {
    const sin = normalizeComparacionFuentes({ ...COMPARACION_R, casos: {}, resumen: {} });
    expect(sin.casos).toBeNull();
    expect(sin.resumen.n_iguales).toBe(1);
    expect(sin.resumen.n_distintas).toBe(2);
    // Variables con categorías propias, no etiquetas.
    expect(sin.resumen.n_con_categorias_exclusivas).toBe(1);
    expect(sin.resumen.diferencia_filas).toBe(10);
  });

  it("los campos nuevos son aditivos: sin `datos`, `especial` ni `fuera_de_lista` no falla", () => {
    const viejo = normalizeComparacionFuentes({
      base_a: { nombre: "a" }, base_b: { nombre: "b" },
      variables: [{ variable: "p1", estado: "igual", categorias: [{ codigo: 1, etiqueta: "Sí", n_a: 1, n_b: 1 }] }],
    });
    expect(viejo.base_a.datos).toBe("");
    expect(viejo.variables[0].categorias[0]).toMatchObject({ especial: false, fuera_de_lista: false });
  });
});

describe("llamadas", () => {
  it("GET de la armonización de una base con el nombre escapado", async () => {
    responde(ARMONIZACION_R);
    const a = await apiCargaArmonizacionBase("base con/barra");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/carga/bases/base%20con%2Fbarra/armonizacion");
    expect(a.formulario?.revision_no).toBe(3);
  });

  it("POST de comparar fuentes con las dos bases", async () => {
    responde(COMPARACION_R);
    const c = await apiCargaCompararFuentes("estudiantes_sm", "estudiantes_sav");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/carga/comparar-fuentes");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ base_a: "estudiantes_sm", base_b: "estudiantes_sav" });
    expect(c.variables).toHaveLength(3);
  });
});
