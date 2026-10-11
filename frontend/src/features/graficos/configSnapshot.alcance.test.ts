// H1 (contrato A7-1): guardar el proyecto con el borrador del informe compartido hidratado NO copia ese plan sobre la
// config de la base activa (ADR 0040 §6.1: ninguna configuración por base se migra o copia implícitamente).

import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  apiGraficosConfigPut: vi.fn(async (_config: unknown) => ({ ok: true as const })),
  sid: "sid-1" as string | null,
}));

vi.mock("../../api/client", () => ({ apiGraficosConfigPut: api.apiGraficosConfigPut }));
vi.mock("../../api/core", () => ({ getSession: () => api.sid }));

import { flushGraficosConfigIfHydrated } from "./configSnapshot";
import { olvidarAlcanceHidratado, registrarAlcanceHidratado } from "./alcanceHidratado";
import { clearSlideCompositionPersistenceAcks } from "./slideCompositionPersistence";
import { usePlanStore, type GraficosConfig } from "./store";

function planCompartido(): GraficosConfig {
  return {
    version: "graficos/4",
    plan: { slides: [{ id: "s-compartida", tipo: "p_slide_portada", payload: { titulo: "Informe compartido" } }] },
  } as unknown as GraficosConfig;
}

function planActivo(): GraficosConfig {
  return {
    version: "graficos/4",
    plan: { slides: [{ id: "s-activa", tipo: "p_slide_portada", payload: { titulo: "Base docentes" } }] },
  } as unknown as GraficosConfig;
}

function editar() {
  usePlanStore.setState({ dirty: true });
}

describe("flush de Gráficos según el alcance hidratado", () => {
  beforeEach(() => {
    api.apiGraficosConfigPut.mockClear();
    api.sid = "sid-1";
    olvidarAlcanceHidratado();
    clearSlideCompositionPersistenceAcks();
    usePlanStore.setState({ hydrated: false, dirty: false });
  });

  it("hidratado el borrador compartido, el flush no escribe /graficos/config", async () => {
    const persistirConsolidado = vi.fn(async (_config: unknown) => 4);
    usePlanStore.getState().hydrate(planCompartido());
    registrarAlcanceHidratado({ scope: "consolidated", sid: "sid-1", persistirConsolidado });
    editar();

    await flushGraficosConfigIfHydrated();

    expect(api.apiGraficosConfigPut).toHaveBeenCalledTimes(0);
  });

  it("con cambios en el compartido delega en su persistidor y marca limpio sólo tras guardar", async () => {
    let soltar: (revision: number) => void = () => { throw new Error("persistidor no iniciado"); };
    const persistirConsolidado = vi.fn((_config: unknown) => new Promise<number>((resolve) => { soltar = resolve; }));
    usePlanStore.getState().hydrate(planCompartido());
    registrarAlcanceHidratado({ scope: "consolidated", sid: "sid-1", persistirConsolidado });
    editar();

    const pendiente = flushGraficosConfigIfHydrated();
    await Promise.resolve();
    expect(persistirConsolidado).toHaveBeenCalledTimes(1);
    const enviado = persistirConsolidado.mock.calls[0]?.[0] as GraficosConfig;
    expect(enviado.plan.slides.map((s) => s.id)).toEqual(["s-compartida"]);
    expect(usePlanStore.getState().dirty).toBe(true);
    soltar(5);
    await expect(pendiente).resolves.toBe(true);
    expect(usePlanStore.getState().dirty).toBe(false);
    expect(api.apiGraficosConfigPut).toHaveBeenCalledTimes(0);
  });

  it("sin cambios en el compartido no escribe nada: la siembra sigue siendo una propuesta", async () => {
    const persistirConsolidado = vi.fn(async (_config: unknown) => 1);
    usePlanStore.getState().hydrate(planCompartido());
    registrarAlcanceHidratado({ scope: "consolidated", sid: "sid-1", persistirConsolidado });

    await expect(flushGraficosConfigIfHydrated()).resolves.toBe(false);
    expect(persistirConsolidado).not.toHaveBeenCalled();
    expect(api.apiGraficosConfigPut).not.toHaveBeenCalled();
  });

  it("en otra sesión no escribe ni con el persistidor del compartido ni como base activa", async () => {
    const persistirConsolidado = vi.fn(async (_config: unknown) => 2);
    usePlanStore.getState().hydrate(planCompartido());
    registrarAlcanceHidratado({ scope: "consolidated", sid: "sid-1", persistirConsolidado });
    editar();
    api.sid = "sid-2";

    await expect(flushGraficosConfigIfHydrated()).resolves.toBe(false);
    expect(persistirConsolidado).not.toHaveBeenCalled();
    expect(api.apiGraficosConfigPut).not.toHaveBeenCalled();
    expect(usePlanStore.getState().dirty).toBe(true);
  });

  it("hidratar el compartido y luego la base activa vuelve a escribir la base activa (1 PUT)", async () => {
    const persistirConsolidado = vi.fn(async (_config: unknown) => 3);
    usePlanStore.getState().hydrate(planCompartido());
    registrarAlcanceHidratado({ scope: "consolidated", sid: "sid-1", persistirConsolidado });
    usePlanStore.getState().hydrate(planActivo());
    registrarAlcanceHidratado({ scope: "active", sid: "sid-1" });

    await expect(flushGraficosConfigIfHydrated()).resolves.toBe(true);
    expect(api.apiGraficosConfigPut).toHaveBeenCalledTimes(1);
    const enviado = api.apiGraficosConfigPut.mock.calls[0]?.[0] as GraficosConfig;
    expect(enviado.plan.slides.map((s) => s.id)).toEqual(["s-activa"]);
    expect(persistirConsolidado).not.toHaveBeenCalled();
  });

  it("sin hidratación registrada conserva el comportamiento histórico de la base activa", async () => {
    usePlanStore.getState().hydrate(planActivo());

    await expect(flushGraficosConfigIfHydrated()).resolves.toBe(true);
    expect(api.apiGraficosConfigPut).toHaveBeenCalledTimes(1);
  });

  it("sin hidratar no escribe", async () => {
    await expect(flushGraficosConfigIfHydrated()).resolves.toBe(false);
    expect(api.apiGraficosConfigPut).not.toHaveBeenCalled();
  });
});
