// M3: el inspector (useConteoRegla) y la maqueta (useTotalesRegla) piden el mismo conteo al abrir una lámina; la caché de
// módulo por firma los deja en un solo pedido. Y la ficha de la maqueta dice «Las 22 bajo 60%» con el conteo, la regla
// sola sin él.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const contar = vi.hoisted(() => vi.fn(async () => ({
  total: 22, seleccionadas: ["p1"], candidatas: [{ tema: "p1", etiqueta: "P1", metrica: 41, seleccionada: true }],
  texto_regla: "Se muestran las 22 bajo 60%.", avisos: [],
})));
vi.mock("../../../../api/graficosRegla", async (original) => ({ ...(await original<object>()), apiGraficosConteoRegla: contar }));

import { ESPERA_CONTEO_MS, useConteoRegla, useTotalesRegla } from "./useConteoRegla";
import { olvidarConteosRegla, pedirConteoRegla } from "./cacheConteoRegla";
import { firmaPedidoRegla, reglaConConteo } from "./modeloReglaPreguntas";
import { firmaReglaDeRanura } from "../maqueta/reglaDeRanura";

const ARGS = { vars: ["docentes$*", "estudiantes$*"], regla: { tipo: "bajo_umbral", umbral: 60 } };
const FIRMA = firmaPedidoRegla("p_panorama", ARGS, "active");

let inspector: ReturnType<typeof useConteoRegla> | null = null;
let maqueta: ReadonlyMap<string, number> | null = null;
function Inspector() {
  inspector = useConteoRegla("p_panorama", { ...ARGS }, "active", true);
  return null;
}
function Maqueta() {
  maqueta = useTotalesRegla([firmaReglaDeRanura({ graficador: "p_panorama", args: { ...ARGS } }, "active"), ""]);
  return null;
}

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; window?: unknown };
g.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof g.window === "undefined") g.window = { HTMLIFrameElement: class {} };
const doc = { nodeType: 9, documentElement: { namespaceURI: "http://www.w3.org/1999/xhtml" }, addEventListener: () => undefined, removeEventListener: () => undefined };
const contenedor = () => ({ nodeType: 1, tagName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as Element;

let root: Root | null = null;
const vaciarMicrotareas = async () => { for (let i = 0; i < 20; i += 1) await act(async () => { await Promise.resolve(); }); };
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { act(() => root?.unmount()); root = null; inspector = null; maqueta = null; contar.mockClear(); olvidarConteosRegla(); vi.useRealTimers(); });

describe("caché del conteo de la regla", () => {
  it("la maqueta usa la misma firma que el inspector", () => {
    expect(firmaReglaDeRanura({ graficador: "p_panorama", args: ARGS }, "active")).toBe(FIRMA);
    expect(firmaReglaDeRanura({ graficador: "p_barras_apiladas", args: ARGS }, "active")).toBe("");
    expect(firmaReglaDeRanura({ graficador: "p_panorama", args: { vars: ["d$*"] } }, "active")).toBe("");
  });

  it("dos consumidores de la misma firma hacen un solo pedido", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<><Inspector /><Maqueta /></>); });
    expect(maqueta?.size).toBe(0);   // mientras no llega: sin número
    await act(async () => { vi.advanceTimersByTime(ESPERA_CONTEO_MS); });
    await vaciarMicrotareas();
    expect(contar).toHaveBeenCalledTimes(1);
    expect(inspector?.conteo?.total).toBe(22);
    expect(maqueta?.get(FIRMA)).toBe(22);
  });

  it("lo ya contado se reusa sin pedir ni esperar", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<Inspector />); });
    await act(async () => { vi.advanceTimersByTime(ESPERA_CONTEO_MS); });
    await vaciarMicrotareas();
    await act(async () => { root?.render(<><Inspector /><Maqueta /></>); });
    expect(maqueta?.get(FIRMA)).toBe(22);
    expect(contar).toHaveBeenCalledTimes(1);
  });

  it("un pedido en vuelo se aborta sólo cuando lo sueltan todos", () => {
    const a = pedirConteoRegla(FIRMA, () => undefined);
    const b = pedirConteoRegla(FIRMA, () => undefined);
    expect(contar).toHaveBeenCalledTimes(1);
    const senal = (contar.mock.calls[0] as unknown as [unknown, { signal: AbortSignal }])[1].signal;
    a();
    expect(senal.aborted).toBe(false);
    b();
    expect(senal.aborted).toBe(true);
  });
});

describe("la regla con su conteo en la ficha", () => {
  const bajo = { tipo: "bajo_umbral" as const, umbral: 60 };
  it("con el número y sin él", () => {
    expect(reglaConConteo(bajo, 2, 22)).toBe("Las 22 bajo 60% en algún público");
    expect(reglaConConteo(bajo, 1, 22)).toBe("Las 22 bajo 60% del indicador");
    expect(reglaConConteo(bajo, 2, null)).toBe("Bajo 60% en algún público");
    expect(reglaConConteo(bajo, 2, 0)).toBe("Ninguna bajo 60% en algún público");
    expect(reglaConConteo({ tipo: "mayor_diferencia", n: 10 }, 2, 1234)).toBe("Las 1,234 de mayor diferencia");
    expect(reglaConConteo({ tipo: "extremos", n: 5 }, 2, 10)).toBe("Las 5 más altas y las 5 más bajas");
  });
});
