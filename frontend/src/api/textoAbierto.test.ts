// GET/PUT /api/texto-abierto/diccionario (TXT-6/7): el diccionario de una pregunta abierta y sus palabras reconocidas.
// Plumber desempaca vectores de uno, manda `NULL` como `{}` y listas de un elemento como objeto suelto; el normalizador
// no debe romperse ni inventar un grupo o una exclusión.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./core";
import {
  apiGuardarTextoAbiertoDiccionario,
  apiTextoAbiertoDiccionario,
  normalizeTextoAbiertoDiccionario,
} from "./textoAbierto";

const CANONICO = {
  ok: true, base: "ccss", variable: "coment",
  diccionario: { equivalencias: [{ mostrar: "estudiantes", formas: ["alumnos", "estudiantes"] }], excluir: ["ciencias sociales"], frases: [] },
  palabras: [
    { raiz: "estudiant", forma: "estudiantes", formas: ["estudiantes", "estudiante"], personas: 11, grupo: "estudiantes", excluida: false, frases: [], excluida_en: [] },
    { raiz: "alumn", forma: "alumnos", formas: ["alumnos"], personas: 3, grupo: "estudiantes", excluida: false, frases: [], excluida_en: [] },
    { raiz: "social", forma: "sociales", formas: ["sociales"], personas: 4, excluida: false, frases: [], excluida_en: ["ciencias sociales"] },
  ],
  grupos: [{ mostrar: "estudiantes", formas: ["alumnos", "estudiantes"], raices: ["alumn", "estudiant"], personas: 13 }],
  frases_detectadas: [{ clave: "ciencias sociales", forma: "ciencias sociales", personas: 5, fija: false, excluida: true }],
  resumen: { escribieron: 40, con_contenido: 31, n_palabras: 3 },
};

describe("normalizeTextoAbiertoDiccionario", () => {
  it("lee el payload canónico", () => {
    const out = normalizeTextoAbiertoDiccionario(CANONICO);
    expect(out.variable).toBe("coment");
    expect(out.base).toBe("ccss");
    expect(out.diccionario).toEqual({ equivalencias: [{ mostrar: "estudiantes", formas: ["alumnos", "estudiantes"] }], excluir: ["ciencias sociales"], frases: [] });
    expect(out.palabras[0]).toEqual({ clave: "estudiant", forma: "estudiantes", formas: ["estudiantes", "estudiante"], personas: 11, grupo: "estudiantes", excluida: false, frases: [], excluidaEn: [] });
    expect(out.palabras[2].grupo).toBeNull();
    expect(out.palabras[2].excluidaEn).toEqual(["ciencias sociales"]);
    expect(out.grupos[0]).toEqual({ mostrar: "estudiantes", formas: ["alumnos", "estudiantes"], personas: 13 });
    expect(out.frasesDetectadas[0]).toEqual({ clave: "ciencias sociales", forma: "ciencias sociales", personas: 5, fija: false, excluida: true });
    expect(out.resumen).toEqual({ escribieron: 40, conContenido: 31, nPalabras: 3 });
  });

  it("tolera escalares en caja, {} por NULL, listas de uno desempacadas y basura", () => {
    const out = normalizeTextoAbiertoDiccionario({
      variable: ["coment"],
      diccionario: { equivalencias: { mostrar: ["docentes"], formas: ["profesores", "docentes"] }, excluir: "gracias", frases: {} },
      palabras: { raiz: ["docent"], forma: ["docentes"], formas: "docentes", personas: [7], grupo: {}, excluida: [true] },
      grupos: {},
      frases_detectadas: [null, { forma: "", personas: 2 }],
      resumen: {},
    });
    expect(out.diccionario.equivalencias).toEqual([{ mostrar: "docentes", formas: ["profesores", "docentes"] }]);
    expect(out.diccionario.excluir).toEqual(["gracias"]);
    expect(out.diccionario.frases).toEqual([]);
    expect(out.palabras).toEqual([{ clave: "docent", forma: "docentes", formas: ["docentes"], personas: 7, grupo: null, excluida: true, frases: [], excluidaEn: [] }]);
    expect(out.grupos).toEqual([]);
    expect(out.frasesDetectadas).toEqual([]);
    expect(out.resumen).toEqual({ escribieron: 0, conContenido: 0, nPalabras: 1 });
    expect(normalizeTextoAbiertoDiccionario(null).palabras).toEqual([]);
  });
});

describe("cliente", () => {
  beforeEach(() => {
    const mem = new Map<string, string>([["pulso.sessionId", "sid-1"]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("GET pide la pregunta y la base; PUT manda el diccionario completo", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(CANONICO), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await apiTextoAbiertoDiccionario("coment", { base: "ccss" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/texto-abierto/diccionario?variable=coment&base=ccss");
    const dic = { equivalencias: [{ mostrar: "docentes", formas: ["profesores", "docentes"] }], excluir: [], frases: ["ciencias sociales"] };
    await apiGuardarTextoAbiertoDiccionario("coment", dic);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain("/api/texto-abierto/diccionario?variable=coment");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ diccionario: dic });
  });

  it("un 422 llega como ApiError con su código", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "E_TXT_FORMA_REPETIDA", message: "«alumnos» está en dos grupos de equivalencias." } }), { status: 422 })));
    await expect(apiGuardarTextoAbiertoDiccionario("coment", { equivalencias: [], excluir: [], frases: [] })).rejects.toBeInstanceOf(ApiError);
  });
});
