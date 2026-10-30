// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { MonitoreoCuotasEstado } from "../../../../../api/monitoreoCuotas";

const getMonitoreoCuotas = vi.fn<() => Promise<MonitoreoCuotasEstado>>();
vi.mock("../../../../../api/monitoreoCuotas", () => ({ getMonitoreoCuotas: () => getMonitoreoCuotas() }));

const estado = (n: number) => ({ preparando: false, cuotas: [], publicos: [], n } as unknown as MonitoreoCuotasEstado);

describe("cuotasRecientes", () => {
  beforeEach(() => {
    vi.resetModules();
    getMonitoreoCuotas.mockReset();
  });

  test("dos lecturas simultáneas comparten una sola petición", async () => {
    const { leerCuotas } = await import("./cuotasRecientes");
    getMonitoreoCuotas.mockResolvedValue(estado(1));
    const [a, b] = await Promise.all([leerCuotas(), leerCuotas()]);
    expect(getMonitoreoCuotas).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  test("recuerda lo último leído y la siguiente lectura vuelve a pedir", async () => {
    const { cuotasRecientes, leerCuotas } = await import("./cuotasRecientes");
    expect(cuotasRecientes()).toBeNull();
    getMonitoreoCuotas.mockResolvedValueOnce(estado(1)).mockResolvedValueOnce(estado(2));
    await leerCuotas();
    expect(cuotasRecientes()).toEqual(estado(1));
    await leerCuotas();
    expect(getMonitoreoCuotas).toHaveBeenCalledTimes(2);
    expect(cuotasRecientes()).toEqual(estado(2));
  });

  test("cerrar el proyecto olvida las cuotas del anterior", async () => {
    const { cuotasRecientes, leerCuotas } = await import("./cuotasRecientes");
    getMonitoreoCuotas.mockResolvedValueOnce(estado(1));
    await leerCuotas();
    window.dispatchEvent(new Event("pulso:project-closed"));
    expect(cuotasRecientes()).toBeNull();
  });

  test("una lectura en vuelo del proyecto cerrado no se le entrega al siguiente", async () => {
    const { cuotasRecientes, leerCuotas } = await import("./cuotasRecientes");
    let soltarA: (valor: MonitoreoCuotasEstado) => void = () => undefined;
    getMonitoreoCuotas
      .mockReturnValueOnce(new Promise((resolve) => { soltarA = resolve; }))
      .mockResolvedValueOnce(estado(2));
    const deA = leerCuotas();
    window.dispatchEvent(new Event("pulso:project-closed"));
    const deB = leerCuotas();
    expect(deB).not.toBe(deA);
    await expect(deB).resolves.toEqual(estado(2));
    soltarA(estado(1));
    await deA;
    expect(cuotasRecientes()).toEqual(estado(2));
  });

  test("abrir otro proyecto desde la suite (sid nuevo) también olvida", async () => {
    const { cuotasRecientes, leerCuotas } = await import("./cuotasRecientes");
    getMonitoreoCuotas.mockResolvedValueOnce(estado(1));
    await leerCuotas();
    window.dispatchEvent(new CustomEvent("pulso:session-changed", { detail: { old_sid: "a", new_sid: "b" } }));
    expect(cuotasRecientes()).toBeNull();
  });

  test("un guardado del proyecto anterior que vuelve tarde no se recuerda", async () => {
    const { cuotasRecientes, generacionDeCuotas, recordarCuotas } = await import("./cuotasRecientes");
    const antes = generacionDeCuotas();
    window.dispatchEvent(new Event("pulso:project-closed"));
    recordarCuotas(estado(1), antes);
    expect(cuotasRecientes()).toBeNull();
    recordarCuotas(estado(2));
    expect(cuotasRecientes()).toEqual(estado(2));
  });

  test("un fallo no deja la lectura en vuelo colgada", async () => {
    const { leerCuotas } = await import("./cuotasRecientes");
    getMonitoreoCuotas.mockRejectedValueOnce(new Error("caído")).mockResolvedValueOnce(estado(3));
    await expect(leerCuotas()).rejects.toThrow("caído");
    await expect(leerCuotas()).resolves.toEqual(estado(3));
  });
});
