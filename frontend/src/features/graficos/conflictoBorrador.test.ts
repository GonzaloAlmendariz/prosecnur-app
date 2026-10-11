// A7 H3 con la decisión D2 de Gonzalo: ante un 409 STALE del borrador compartido, conflicto explícito y recarga.

import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  apiGraficosConfigPut: vi.fn(async (_config: unknown) => ({ ok: true as const })),
  sid: "sid-1" as string | null,
}));

vi.mock("../../api/client", () => ({ apiGraficosConfigPut: api.apiGraficosConfigPut }));
vi.mock("../../api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/core")>()),
  getSession: () => api.sid,
}));

import { ApiError } from "../../api/core";
import { useToasterStore } from "../../components/toasterStore";
import { olvidarAlcanceHidratado, registrarAlcanceHidratado } from "./alcanceHidratado";
import { flushGraficosConfigIfHydrated } from "./configSnapshot";
import {
  ACCION_RECARGAR_BORRADOR,
  CODIGO_BORRADOR_STALE,
  ConflictoBorradorError,
  MENSAJE_CONFLICTO_BORRADOR,
  crearRecargaBorrador,
  esConflictoDeRevision,
  guardarBorradorConRevision,
  hayConflictoBorrador,
  limpiarConflictoBorrador,
  recargarBorradorCompartido,
  registrarRecargaBorrador,
  useConflictoBorrador,
} from "./conflictoBorrador";
import { usePlanStore, type GraficosConfig } from "./store";

const stale = () => new ApiError(CODIGO_BORRADOR_STALE, "El borrador compartido cambió desde que se leyó.");

function plan(titulo: string): GraficosConfig {
  return {
    version: "graficos/4",
    plan: { slides: [{ id: `s-${titulo}`, tipo: "p_slide_portada", payload: { titulo } }] },
  } as unknown as GraficosConfig;
}

function toasts() {
  return useToasterStore.getState().toasts;
}

async function entrarEnConflicto() {
  const guardar = vi.fn(async (_revision: number) => { throw stale(); });
  await expect(guardarBorradorConRevision({ revision: 3, sid: "sid-1", guardar })).rejects.toThrow(MENSAJE_CONFLICTO_BORRADOR);
  return guardar;
}

describe("conflicto de revisión del borrador compartido", () => {
  beforeEach(() => {
    limpiarConflictoBorrador();
    registrarRecargaBorrador(null);
    useToasterStore.getState().limpiar();
    olvidarAlcanceHidratado();
    api.apiGraficosConfigPut.mockClear();
    api.sid = "sid-1";
    usePlanStore.getState().hydrate(plan("Compartido"));
  });

  it("un 409 STALE entra en conflicto y avisa con la acción de recargar (no se traga)", async () => {
    await entrarEnConflicto();

    expect(hayConflictoBorrador()).toBe(true);
    expect(useConflictoBorrador.getState().conflicto).toEqual({ sid: "sid-1" });
    expect(toasts()).toHaveLength(1);
    const [aviso] = toasts();
    expect(aviso.tono).toBe("error");
    expect(aviso.duracion).toBe(0);
    expect(`${aviso.mensaje} ${aviso.detalle}`).toBe(MENSAJE_CONFLICTO_BORRADOR);
    expect(aviso.accion?.label).toBe(ACCION_RECARGAR_BORRADOR);
  });

  it("en conflicto ningún guardado repite el PUT con la revisión vieja, y el aviso no se duplica", async () => {
    const primero = await entrarEnConflicto();
    const segundo = vi.fn(async (revision: number) => revision);

    await expect(guardarBorradorConRevision({ revision: 3, sid: "sid-1", guardar: segundo }))
      .rejects.toBeInstanceOf(ConflictoBorradorError);

    expect(primero).toHaveBeenCalledTimes(1);
    expect(segundo).not.toHaveBeenCalled();
    expect(toasts()).toHaveLength(1);
  });

  it("otros errores pasan tal cual y no abren conflicto", async () => {
    const red = new ApiError("E_NETWORK", "Sin conexión");
    await expect(guardarBorradorConRevision({ revision: 3, sid: "sid-1", guardar: async () => { throw red; } }))
      .rejects.toBe(red);
    expect(hayConflictoBorrador()).toBe(false);
    expect(toasts()).toHaveLength(0);
  });

  it("recargar hace GET, hidrata, limpia «dirty» y el conflicto, y cierra el aviso", async () => {
    await entrarEnConflicto();
    usePlanStore.setState({ dirty: true });
    const leer = vi.fn(async () => ({ config: plan("Guardado por otra pestaña"), revision: 7 }));
    const hidratar = vi.fn((r: { config: GraficosConfig; revision: number }) => {
      // Igual que el hook: hidrata y, aparte, puede quedar un cambio local marcado antes de que llegue el markClean.
      usePlanStore.getState().hydrate(r.config);
      usePlanStore.setState({ dirty: true });
    });
    registrarRecargaBorrador(crearRecargaBorrador({ leer, hidratar }));

    await recargarBorradorCompartido();

    expect(leer).toHaveBeenCalledTimes(1);
    expect(hidratar).toHaveBeenCalledWith({ config: plan("Guardado por otra pestaña"), revision: 7 });
    expect(usePlanStore.getState().plan.slides[0]?.id).toBe("s-Guardado por otra pestaña");
    expect(usePlanStore.getState().dirty).toBe(false);
    expect(hayConflictoBorrador()).toBe(false);
    expect(toasts()).toHaveLength(0);
  });

  it("la acción del aviso es la recarga registrada", async () => {
    const leer = vi.fn(async () => ({ revision: 8 }));
    registrarRecargaBorrador(crearRecargaBorrador({ leer, hidratar: () => undefined }));
    await entrarEnConflicto();

    toasts()[0]?.accion?.onSelect();
    await vi.waitFor(() => expect(hayConflictoBorrador()).toBe(false));
    expect(leer).toHaveBeenCalledTimes(1);
  });

  it("si la recarga falla, el conflicto sigue y se avisa", async () => {
    await entrarEnConflicto();
    usePlanStore.setState({ dirty: true });
    registrarRecargaBorrador(crearRecargaBorrador({ leer: async () => { throw new Error("red"); }, hidratar: () => undefined }));

    await recargarBorradorCompartido();

    expect(hayConflictoBorrador()).toBe(true);
    expect(useConflictoBorrador.getState().recargando).toBe(false);
    expect(usePlanStore.getState().dirty).toBe(true);
    expect(toasts().map((t) => t.mensaje)).toContain("No se pudo recargar el informe compartido. Vuelve a intentarlo.");
  });

  it("guardar el proyecto con conflicto pendiente falla con el mismo mensaje y no escribe nada", async () => {
    await entrarEnConflicto();
    const put = vi.fn(async (revision: number) => revision);
    registrarAlcanceHidratado({
      scope: "consolidated",
      sid: "sid-1",
      persistirConsolidado: () => guardarBorradorConRevision({ revision: 3, sid: "sid-1", guardar: put }),
    });
    usePlanStore.setState({ dirty: true });

    await expect(flushGraficosConfigIfHydrated()).rejects.toThrow(MENSAJE_CONFLICTO_BORRADOR);

    expect(put).not.toHaveBeenCalled();
    expect(api.apiGraficosConfigPut).not.toHaveBeenCalled();
    expect(usePlanStore.getState().dirty).toBe(true);
  });

  it("reconoce el STALE por código, por el texto canónico del cliente y por su propio error", () => {
    expect(esConflictoDeRevision(stale())).toBe(true);
    expect(esConflictoDeRevision(`Algo · ${CODIGO_BORRADOR_STALE}`)).toBe(true);
    expect(esConflictoDeRevision(new ConflictoBorradorError())).toBe(true);
    expect(esConflictoDeRevision(new ApiError("E_FORM_DRAFT_STALE", "otro borrador"))).toBe(false);
    expect(esConflictoDeRevision(null)).toBe(false);
  });
});
