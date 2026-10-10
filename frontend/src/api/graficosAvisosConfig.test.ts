import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cada prueba importa los módulos de nuevo: el canal guarda estado de módulo (pendientes y sumidero).
async function cargar() {
  vi.resetModules();
  const canal = await import("./graficosAvisosConfig");
  const api = await import("./graficos");
  return { ...canal, ...api };
}

function respuesta(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const AVISO = "6 láminas usaban un tipo de población que ya no está en el recetario y pasan a su tipo vigente";

describe("avisos de GET /api/graficos/config (migración de la población antigua)", () => {
  beforeEach(() => {
    const store = new Map<string, string>([["pulso.sessionId", "s1"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("el normalizador acepta la lista, el escalar suelto de jsonlite, y descarta basura y repetidos", async () => {
    const { normalizarAvisosConfig } = await cargar();
    expect(normalizarAvisosConfig([AVISO, "  ", 7, null, AVISO])).toEqual([AVISO]);
    expect(normalizarAvisosConfig(AVISO)).toEqual([AVISO]);
    expect(normalizarAvisosConfig(undefined)).toEqual([]);
    expect(normalizarAvisosConfig({ a: 1 })).toEqual([]);
  });

  it("el GET devuelve `avisos` normalizado y una respuesta sin el campo da lista vacía", async () => {
    const { apiGraficosConfigGet } = await cargar();
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ ok: true, config: { plan: {} }, avisos: [AVISO] })));
    expect((await apiGraficosConfigGet()).avisos).toEqual([AVISO]);
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ ok: true, config: { plan: {} } })));
    expect((await apiGraficosConfigGet()).avisos).toEqual([]);
  });

  it("si el GET del calentamiento llega antes que la vista, el aviso espera y la vista lo recibe (el backend no lo repite)", async () => {
    const { apiGraficosConfigGet, fijarSumideroAvisosConfig } = await cargar();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respuesta({ ok: true, config: {}, avisos: [AVISO] }))
      .mockResolvedValue(respuesta({ ok: true, config: {}, avisos: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await apiGraficosConfigGet(); // warmupRegistry: nadie lee `avisos`
    await apiGraficosConfigGet(); // hidratación: ya no los trae
    const recibidos: Array<[string | null, string[]]> = [];
    fijarSumideroAvisosConfig((sid, avisos) => { recibidos.push([sid, avisos]); });
    expect(recibidos).toEqual([["s1", [AVISO]]]);
  });

  it("con el destino ya fijado se entrega en el acto, una sola vez", async () => {
    const { publicarAvisosConfig, fijarSumideroAvisosConfig } = await cargar();
    const destino = vi.fn();
    fijarSumideroAvisosConfig(destino);
    publicarAvisosConfig("s1", [AVISO]);
    publicarAvisosConfig("s1", []);
    expect(destino).toHaveBeenCalledTimes(1);
    expect(destino).toHaveBeenCalledWith("s1", [AVISO]);
  });
});
