import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agruparAvisos, totalAvisos } from "./laminas/resumenInforme";

function almacenEnMemoria(inicial: Record<string, string> = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
    m,
  };
}

async function cargar(sid: string, session: ReturnType<typeof almacenEnMemoria>) {
  vi.resetModules();
  vi.stubGlobal("localStorage", almacenEnMemoria({ "pulso.sessionId": sid }));
  vi.stubGlobal("sessionStorage", session);
  const canal = await import("../../api/graficosAvisosConfig");
  const mod = await import("./avisosPlan");
  return { ...canal, ...mod };
}

describe("avisos del plan al abrirlo", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("lo que publicó el calentamiento antes de cargar Gráficos llega al store, sin repetir, y Láminas lo cuenta", async () => {
    const session = almacenEnMemoria();
    vi.resetModules();
    vi.stubGlobal("localStorage", almacenEnMemoria({ "pulso.sessionId": "s1" }));
    vi.stubGlobal("sessionStorage", session);
    const { publicarAvisosConfig } = await import("../../api/graficosAvisosConfig");
    publicarAvisosConfig("s1", ["Lámina 3 migrada"]);
    const { useAvisosPlan } = await import("./avisosPlan");
    expect(useAvisosPlan.getState()).toMatchObject({ sid: "s1", avisos: ["Lámina 3 migrada"], visto: false });

    publicarAvisosConfig("s1", ["Lámina 3 migrada", "Lámina 9 migrada"]);
    expect(useAvisosPlan.getState().avisos).toEqual(["Lámina 3 migrada", "Lámina 9 migrada"]);

    const g = agruparAvisos([], {}, [], useAvisosPlan.getState().avisos);
    expect(totalAvisos(g)).toBe(2);
  });

  it("sobrevive a recargar la ventana en la misma sesión, con su estado de visto", async () => {
    const session = almacenEnMemoria();
    const a = await cargar("s1", session);
    a.publicarAvisosConfig("s1", ["Lámina 3 migrada"]);
    a.useAvisosPlan.getState().marcarVisto();
    const b = await cargar("s1", session); // recarga: el backend ya no lo repite
    expect(b.useAvisosPlan.getState()).toMatchObject({ sid: "s1", avisos: ["Lámina 3 migrada"], visto: true });
  });

  it("al cambiar de sesión se borra", async () => {
    const session = almacenEnMemoria();
    const a = await cargar("s1", session);
    a.publicarAvisosConfig("s1", ["Lámina 3 migrada"]);
    const b = await cargar("s2", session);
    expect(b.useAvisosPlan.getState()).toMatchObject({ sid: "s2", avisos: [] });
    expect(session.m.has(b.CLAVE_AVISOS_PLAN)).toBe(false);
  });

  it("un aviso nuevo vuelve a pedir atención aunque los anteriores ya se hayan visto", async () => {
    const a = await cargar("s1", almacenEnMemoria());
    a.publicarAvisosConfig("s1", ["Lámina 3 migrada"]);
    a.useAvisosPlan.getState().marcarVisto();
    a.publicarAvisosConfig("s1", ["Lámina 3 migrada"]);
    expect(a.useAvisosPlan.getState().visto).toBe(true);
    a.publicarAvisosConfig("s1", ["Lámina 9 migrada"]);
    expect(a.useAvisosPlan.getState().visto).toBe(false);
  });

  it("lo guardado se lee defensivamente", async () => {
    const { leerAvisosPlan, CLAVE_AVISOS_PLAN } = await cargar("s1", almacenEnMemoria());
    expect(leerAvisosPlan(almacenEnMemoria({ [CLAVE_AVISOS_PLAN]: "{roto" }), "s1").avisos).toEqual([]);
    expect(leerAvisosPlan(almacenEnMemoria({ [CLAVE_AVISOS_PLAN]: JSON.stringify({ sid: "s1", avisos: ["a", 3, ""], visto: "sí" }) }), "s1"))
      .toEqual({ sid: "s1", avisos: ["a"], visto: false });
    expect(leerAvisosPlan(null, "s1").avisos).toEqual([]);
  });

  it("el toast es un recordatorio que se cierra solo y remite al panel; verlo no borra los avisos", async () => {
    const a = await cargar("s1", almacenEnMemoria());
    const t = a.toastAvisosPlan(["Lámina 3 migrada", "Lámina 9 migrada"]);
    expect(t.duracion).toBe(a.DURACION_TOAST_AVISOS_PLAN);
    expect(t.duracion).toBeGreaterThanOrEqual(6000);
    expect(t.duracion).toBeLessThanOrEqual(15000);
    expect(t.mensaje).toBe("El plan de gráficos cambió al abrirlo (2 avisos)");
    expect(t.detalle).toContain("Láminas › Avisos");
    a.publicarAvisosConfig("s1", ["Lámina 3 migrada"]);
    a.useAvisosPlan.getState().marcarVisto(); // lo que pasa cuando el toast se cierra por tiempo
    expect(a.useAvisosPlan.getState()).toMatchObject({ avisos: ["Lámina 3 migrada"], visto: true });
  });
});
