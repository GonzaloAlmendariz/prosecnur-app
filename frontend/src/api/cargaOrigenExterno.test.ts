import { describe, expect, it, vi } from "vitest";
import { declararOrigenExterno, normalizeOrigenExterno } from "./cargaOrigenExterno";

const fetchMock = vi.hoisted(() => vi.fn<(input: string, init?: RequestInit) => Promise<Response>>());

vi.mock("./core", () => ({
  apiFetch: fetchMock,
  headers: (extra: Record<string, string> = {}) => extra,
  handle: async (res: Response) => res.json(),
}));
vi.mock("./estudio", () => ({ apiUpload: vi.fn() }));

// Fixture del contrato `GET/POST /api/carga/origen-externo` (ADR 0100, P2),
// con la forma en que R serializa: escalares de largo uno y listas desenrolladas.
const HSYVBG = {
  ok: [true],
  base: ["hostigamiento"],
  estado: ["vigente"],
  bloque: {
    enabled: [true],
    script: ["limpieza_hostigamiento.R"],
    version: ["v3"],
    n_recibidas: [3327],
    n_recibidas_deducida: [false],
    n_entregadas: [3318],
    n_excluidas: [9],
    data_file_id: ["abc"],
    declarado_at: ["2026-10-13T15:00:00Z"],
  },
  resumen: {
    recibidas: [3327],
    excluidas: [9],
    entregadas: [3318],
    por_categoria: [
      { categoria: ["ambiguo"], n: [6] },
      { categoria: ["crítico"], n: [3] },
    ],
  },
};

describe("normalizeOrigenExterno", () => {
  it("lee el caso HSyVBG con escalares de largo uno", () => {
    const out = normalizeOrigenExterno(HSYVBG);
    expect(out.base).toBe("hostigamiento");
    expect(out.estado).toBe("vigente");
    expect(out.bloque).toMatchObject({
      script: "limpieza_hostigamiento.R",
      version: "v3",
      n_recibidas: 3327,
      n_recibidas_deducida: false,
      n_entregadas: 3318,
      n_excluidas: 9,
      enabled: true,
    });
    expect(out.resumen).toEqual({
      recibidas: 3327,
      excluidas: 9,
      entregadas: 3318,
      por_categoria: [
        { categoria: "ambiguo", n: 6 },
        { categoria: "crítico", n: 3 },
      ],
      variables_retiradas: { total: 0, por_motivo: [] },
    });
    expect(out.avisos).toEqual([]);
    // El backend de antes de P2b no manda variables: se leen vacías, no rompen.
    expect(out.variables_faltantes).toEqual([]);
    expect(out.bloque?.variables_retiradas).toEqual([]);
  });

  it("acepta por_categoria desenrollado o por columnas", () => {
    const uno = normalizeOrigenExterno({
      ...HSYVBG,
      resumen: { ...HSYVBG.resumen, por_categoria: { categoria: "crítico", n: 9 } },
    });
    expect(uno.resumen?.por_categoria).toEqual([{ categoria: "crítico", n: 9 }]);
    const columnas = normalizeOrigenExterno({
      ...HSYVBG,
      resumen: { ...HSYVBG.resumen, por_categoria: { categoria: ["a", "b"], n: [4, 5] } },
    });
    expect(columnas.resumen?.por_categoria).toEqual([{ categoria: "a", n: 4 }, { categoria: "b", n: 5 }]);
  });

  it("sin declaración: R manda NULL como {} o [] y el estado vacío", () => {
    for (const bloque of [null, {}, [], undefined]) {
      const out = normalizeOrigenExterno({ ok: true, base: "b", estado: "", bloque, resumen: {} });
      expect(out.estado).toBe("");
      expect(out.bloque).toBeNull();
      expect(out.resumen).toBeNull();
    }
  });

  it("un bloque deshabilitado no es declaración aunque el estado diga vigente", () => {
    const out = normalizeOrigenExterno({ ...HSYVBG, bloque: { ...HSYVBG.bloque, enabled: [false] } });
    expect(out.bloque).toBeNull();
    expect(out.estado).toBe("");
  });

  it("conserva otra_base y lee un estado desconocido con bloque como vigente", () => {
    expect(normalizeOrigenExterno({ ...HSYVBG, estado: ["otra_base"] }).estado).toBe("otra_base");
    expect(normalizeOrigenExterno({ ...HSYVBG, estado: ["raro"] }).estado).toBe("vigente");
  });

  it("NA o ausente no se vuelve cero en las recibidas", () => {
    const out = normalizeOrigenExterno({
      ...HSYVBG,
      bloque: { ...HSYVBG.bloque, n_recibidas: ["NA"], n_entregadas: null },
      resumen: { excluidas: [9] },
    });
    expect(out.bloque?.n_recibidas).toBeNull();
    expect(out.bloque?.n_entregadas).toBeNull();
    expect(out.resumen?.recibidas).toBeNull();
    expect(out.resumen?.por_categoria).toEqual([]);
  });

  it("lee avisos desenrollados y descarta los que no traen mensaje", () => {
    const out = normalizeOrigenExterno({
      ...HSYVBG,
      avisos: { codigo: ["no_cuadra"], mensaje: ["Se declararon 3330 recibidas…"] },
    });
    expect(out.avisos).toEqual([{ codigo: "no_cuadra", mensaje: "Se declararon 3330 recibidas…" }]);
    const varios = normalizeOrigenExterno({
      ...HSYVBG,
      avisos: [
        { codigo: "duplicadas", mensaje: "La lista repite 1 identificador(es)." },
        { codigo: "nuevo_codigo", mensaje: "Algo que el front no conoce." },
        { codigo: "sin_motivo", mensaje: "" },
      ],
    });
    expect(varios.avisos.map((aviso) => aviso.codigo)).toEqual(["duplicadas", "otro"]);
  });

  it("no expone identificadores aunque el payload los trajera", () => {
    const out = normalizeOrigenExterno({
      ...HSYVBG,
      bloque: { ...HSYVBG.bloque, exclusiones: [{ id: "uuid-secreto", motivo: "burla" }] },
    });
    expect(JSON.stringify(out)).not.toContain("uuid-secreto");
  });

  it("variables_faltantes siempre viene: lista, desenrollada, por columnas o vacía", () => {
    const lista = normalizeOrigenExterno({
      ...HSYVBG,
      variables_faltantes: [
        { variable: ["start"], tipo: ["start"], motivo_sugerido: ["metadato"] },
        { variable: ["p12"], tipo: ["select_one"], motivo_sugerido: [""] },
        { variable: ["p12"], tipo: ["select_one"], motivo_sugerido: [""] },
        { variable: [""], tipo: ["text"] },
        { variable: ["p13"], tipo: ["text"], motivo_sugerido: ["raro"] },
      ],
    });
    expect(lista.variables_faltantes).toEqual([
      { variable: "start", tipo: "start", motivo_sugerido: "metadato" },
      { variable: "p12", tipo: "select_one", motivo_sugerido: "" },
      { variable: "p13", tipo: "text", motivo_sugerido: "" },
    ]);
    const uno = normalizeOrigenExterno({
      ...HSYVBG,
      variables_faltantes: { variable: ["end"], tipo: ["end"], motivo_sugerido: ["metadato"] },
    });
    expect(uno.variables_faltantes).toEqual([{ variable: "end", tipo: "end", motivo_sugerido: "metadato" }]);
    const columnas = normalizeOrigenExterno({
      ...HSYVBG,
      variables_faltantes: { variable: ["a", "b"], tipo: ["text", "integer"], motivo_sugerido: ["", ""] },
    });
    expect(columnas.variables_faltantes.map((v) => v.variable)).toEqual(["a", "b"]);
    for (const vacio of [[], {}, null, undefined]) {
      expect(normalizeOrigenExterno({ ...HSYVBG, variables_faltantes: vacio }).variables_faltantes).toEqual([]);
    }
    // Sin bloque también se leen: la detección no depende de declarar.
    const sinBloque = normalizeOrigenExterno({
      ok: true,
      base: "b",
      estado: "",
      bloque: {},
      variables_faltantes: [{ variable: "start", tipo: "start", motivo_sugerido: "metadato" }],
    });
    expect(sinBloque.bloque).toBeNull();
    expect(sinBloque.variables_faltantes).toHaveLength(1);
  });

  it("lee las variables retiradas del bloque y su resumen por motivo", () => {
    const out = normalizeOrigenExterno({
      ...HSYVBG,
      bloque: {
        ...HSYVBG.bloque,
        n_variables_retiradas: [3],
        variables_retiradas: [
          { variable: ["start"], tipo: ["start"], motivo: ["metadato"] },
          { variable: ["end"], tipo: ["end"], motivo: ["metadato"] },
          { variable: ["p40"], tipo: ["text"], motivo: ["no_va_al_cliente"] },
        ],
      },
      resumen: {
        ...HSYVBG.resumen,
        variables_retiradas: {
          total: [3],
          por_motivo: [
            { motivo: ["no_va_al_cliente"], n: [1] },
            { motivo: ["metadato"], n: [2] },
          ],
        },
      },
      variables_excluidas_agregadas: ["start", "end", "p40"],
      avisos: [{ codigo: ["variable_presente"], mensaje: ["p12 sí está en la base."] }],
    });
    expect(out.bloque?.n_variables_retiradas).toBe(3);
    expect(out.bloque?.variables_retiradas[2]).toEqual({ variable: "p40", tipo: "text", motivo: "no_va_al_cliente" });
    // El desglose sale en el orden de los motivos, no en el del backend.
    expect(out.resumen?.variables_retiradas).toEqual({
      total: 3,
      por_motivo: [
        { motivo: "metadato", n: 2 },
        { motivo: "no_va_al_cliente", n: 1 },
      ],
    });
    expect(out.variables_excluidas_agregadas).toEqual(["start", "end", "p40"]);
    expect(out.avisos).toEqual([{ codigo: "variable_presente", mensaje: "p12 sí está en la base." }]);
  });

  it("sin desglose ni conteo del backend, cuenta del bloque; una sola excluida llega como escalar", () => {
    const out = normalizeOrigenExterno({
      ...HSYVBG,
      bloque: {
        ...HSYVBG.bloque,
        variables_retiradas: { variable: ["p40"], tipo: ["text"], motivo: ["desconocido"] },
      },
      variables_excluidas_agregadas: ["p40"],
    });
    expect(out.bloque?.n_variables_retiradas).toBe(1);
    expect(out.bloque?.variables_retiradas[0].motivo).toBe("otra");
    expect(out.resumen?.variables_retiradas).toEqual({ total: 1, por_motivo: [{ motivo: "otra", n: 1 }] });
    expect(out.variables_excluidas_agregadas).toEqual(["p40"]);
    expect(normalizeOrigenExterno(HSYVBG).variables_excluidas_agregadas).toEqual([]);
    expect(normalizeOrigenExterno(HSYVBG).resumen?.variables_retiradas).toEqual({ total: 0, por_motivo: [] });
  });
});

describe("declararOrigenExterno", () => {
  function cuerpoEnviado(): Record<string, unknown> {
    const init = fetchMock.mock.calls.at(-1)?.[1];
    return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
  }

  it("declara sólo variables: sin file_id y con los motivos elegidos", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, base: "b", estado: "" })));
    await declararOrigenExterno({
      baseNombre: "b",
      variablesMotivo: { start: "metadato", p40: "no_va_al_cliente" },
    });
    expect(cuerpoEnviado()).toEqual({
      base_nombre: "b",
      variables_motivo: { start: "metadato", p40: "no_va_al_cliente" },
    });
  });

  it("sin lista ni motivos no llama al backend", async () => {
    fetchMock.mockClear();
    await expect(declararOrigenExterno({ baseNombre: "b", variablesMotivo: {} })).rejects.toThrow(/nada|casos retirados/u);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con lista de casos manda file_id y omite variables_motivo vacío", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    await declararOrigenExterno({ fileId: "f1", nRecibidas: 3327, script: "limpieza.R" });
    expect(cuerpoEnviado()).toEqual({ file_id: "f1", n_recibidas: 3327, script: "limpieza.R" });
  });
});
