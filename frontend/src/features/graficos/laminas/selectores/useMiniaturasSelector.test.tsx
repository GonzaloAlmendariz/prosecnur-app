// @vitest-environment happy-dom
// El hook de la miniatura del selector: pide sólo lo que se ve, con `reemplazar: false` e ids estables, y al cerrar el
// selector cancela sus jobs.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InventarioPublico } from "../../../../api/graficosInventario";
import type { EstadoInventario } from "./fichaDatos";
import { useMiniaturasSelectorStore } from "./miniaturasSelectorStore";
import type { EstudioDelSelector, OpcionLamina } from "./opcionesLamina";
import { useMiniaturasSelector } from "./useMiniaturasSelector";

const { pedir, cancelar } = vi.hoisted(() => ({
  pedir: vi.fn(async () => ({ lote_id: "L1", job_id: "J1" })),
  cancelar: vi.fn(async () => undefined),
}));
vi.mock("../../../../api/graficosMiniaturas", () => ({
  apiGraficosMiniaturas: pedir, apiGraficosMiniaturasLote: vi.fn(), miniaturaSrc: ({ url }: { url: string }) => url,
}));
vi.mock("../../../../api/jobs", () => ({ apiJobCancel: cancelar }));
vi.mock("../../../../lib/SessionContext", () => ({ useSession: () => ({ state: { analitica_prep_ok: true } }) }));
vi.mock("../../configSnapshot", () => ({ buildGraficosConfigFromStore: () => ({}) }));
vi.mock("../miniaturas/pollLote", () => ({ iniciarPollLote: () => () => undefined }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const publico = (base: string): InventarioPublico => ({
  base, publico: base, n: 100,
  preguntas: { escala: 30, opcion_unica: 0, multiple: 0, numerica: 0, abierta: 0 },
  padron: { declarado: false, valor: null, origen: "", motivo: "" },
});
const DOS: EstadoInventario = { estado: "listo", publicos: [publico("docentes"), publico("estudiantes")] };
const UNO: EstadoInventario = { estado: "listo", publicos: [publico("docentes")] };
const ESTUDIO: EstudioDelSelector = {
  bases: ["docentes", "estudiantes"], baseActiva: "docentes", indicador: { codigos: ["4", "5"], etiqueta: "Top Two Box" },
};

function Sonda(p: { opciones: OpcionLamina[]; inventario: EstadoInventario; activo: boolean }) {
  useMiniaturasSelector({ ...p, estudio: ESTUDIO, scope: "active" });
  return null;
}

let host: HTMLDivElement;
let root: Root;
const pintar = (p: { opciones: OpcionLamina[]; inventario: EstadoInventario; activo: boolean }) =>
  act(() => root.render(<Sonda {...p} />));
const esperar = async () => { await act(async () => { vi.advanceTimersByTime(1000); await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => {
  vi.useFakeTimers();
  pedir.mockClear();
  cancelar.mockClear();
  useMiniaturasSelectorStore.getState().reiniciar();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

describe("useMiniaturasSelector", () => {
  it("pide las tarjetas a la vista con `reemplazar: false`, preview rápido e ids estables", async () => {
    pintar({ opciones: ["p_slide_1_grafico:panorama", "p_slide_1_grafico:contraste"], inventario: DOS, activo: true });
    await esperar();
    expect(pedir).toHaveBeenCalledTimes(1);
    const [pedido] = pedir.mock.calls[0] as unknown as [{ slides: { id: string }[]; reemplazar: boolean; preview_quality: string }];
    expect(pedido.reemplazar).toBe(false);
    expect(pedido.preview_quality).toBe("quick");
    expect(pedido.slides.map((s) => s.id)).toEqual(["selector-p_slide_1_grafico-panorama", "selector-p_slide_1_grafico-contraste"]);
  });

  it("con faltas del estudio no pide", async () => {
    pintar({ opciones: ["p_slide_1_grafico:contraste"], inventario: UNO, activo: true });
    await esperar();
    expect(pedir).not.toHaveBeenCalled();
  });

  it("un solo lote en vuelo: la tarjeta siguiente espera a que termine", async () => {
    pintar({ opciones: ["p_slide_1_grafico:panorama"], inventario: DOS, activo: true });
    await esperar();
    pintar({ opciones: ["p_slide_1_grafico:contraste"], inventario: DOS, activo: true });
    await esperar();
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("al cerrar el selector cancela sus jobs", async () => {
    pintar({ opciones: ["p_slide_1_grafico:panorama"], inventario: DOS, activo: true });
    await esperar();
    expect(useMiniaturasSelectorStore.getState().lotes.map((l) => l.jobId)).toEqual(["J1"]);
    pintar({ opciones: ["p_slide_1_grafico:panorama"], inventario: DOS, activo: false });
    expect(cancelar).toHaveBeenCalledWith("J1");
    expect(useMiniaturasSelectorStore.getState().lotes).toEqual([]);
  });
});
