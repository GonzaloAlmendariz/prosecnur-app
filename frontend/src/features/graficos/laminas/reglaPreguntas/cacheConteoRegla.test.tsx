// M3: el inspector (useConteoRegla) y la maqueta (useTotalesRegla) piden el mismo conteo al abrir una lámina; la caché de
// módulo por firma los deja en un solo pedido. Y la ficha de la maqueta dice «Las 22 bajo 60%» con el conteo, la regla
// sola sin él.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// H1: el universo (total, 157 en Arte) no es lo que elige la regla (las seleccionadas, 22). El fixture los separa.
const ELEGIDAS = Array.from({ length: 22 }, (_, i) => `p${i + 1}`);
const contar = vi.hoisted(() => vi.fn(async () => ({
  total: 157, seleccionadas: Array.from({ length: 22 }, (_, i) => `p${i + 1}`),
  candidatas: [{ tema: "p1", etiqueta: "P1", metrica: 41, seleccionada: true }],
  texto_regla: "Se muestran las 22 bajo 60%.", avisos: [],
})));
// H6: la caché se suscribe a los eventos al cargarse; la ventana de prueba guarda sus oyentes para dispararlos.
const escuchados = vi.hoisted(() => {
  const m = new Map<string, () => void>();
  const w = globalThis as { window?: unknown };
  if (typeof w.window === "undefined") {
    w.window = { HTMLIFrameElement: class {}, addEventListener: (e: string, f: () => void) => { m.set(e, f); }, removeEventListener: () => undefined };
  }
  return m;
});
vi.mock("../../../../api/graficosRegla", async (original) => ({ ...(await original<object>()), apiGraficosConteoRegla: contar }));

import { elegidasPorRegla, ESPERA_CONTEO_MS, useConteoRegla, useTotalesRegla } from "./useConteoRegla";
import { conteoEnCache, EVENTOS_QUE_OLVIDAN, olvidarConteosRegla, pedirConteoRegla } from "./cacheConteoRegla";
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
    expect(inspector?.conteo?.total).toBe(157);
    expect(inspector?.conteo?.seleccionadas).toEqual(ELEGIDAS);
    // La ficha dice cuántas elige la regla (22), no el tamaño del universo (157).
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

  it("H1: elegidasPorRegla cuenta las seleccionadas, no el universo", () => {
    expect(elegidasPorRegla({ seleccionadas: ELEGIDAS })).toBe(22);
    expect(elegidasPorRegla({ seleccionadas: [] })).toBe(0);
  });

  it("H6: cambiar de sesión, cerrar el proyecto o reprocesar la base vacía la caché", async () => {
    await act(async () => { root = createRoot(contenedor()); root.render(<Inspector />); });
    await act(async () => { vi.advanceTimersByTime(ESPERA_CONTEO_MS); });
    await vaciarMicrotareas();
    expect(conteoEnCache(FIRMA)).not.toBeNull();
    for (const evento of EVENTOS_QUE_OLVIDAN) {
      if (!conteoEnCache(FIRMA)) { pedirConteoRegla(FIRMA, () => undefined); await vaciarMicrotareas(); }
      expect(conteoEnCache(FIRMA)).not.toBeNull();
      escuchados.get(evento)?.();
      expect(conteoEnCache(FIRMA)).toBeNull();
    }
    // Otros módulos cargados también escuchan algunos de estos eventos: basta con que la caché oiga todos los suyos.
    expect([...escuchados.keys()]).toEqual(expect.arrayContaining([...EVENTOS_QUE_OLVIDAN]));
  });

  it("R5-13: el cambio de base activa y de fuente de la codificación también vacían la caché", () => {
    expect(EVENTOS_QUE_OLVIDAN).toEqual(expect.arrayContaining(["pulso:active-base-changed", "pulso:codif-source-changed"]));
  });

  it("R5-12: el pedido manda la config del editor, como la vista previa", async () => {
    contar.mockClear();
    pedirConteoRegla(FIRMA, () => undefined);
    await vaciarMicrotareas();
    const ultimo = contar.mock.calls.at(-1) as unknown as [{ config?: { presets?: unknown } }] | undefined;
    expect(ultimo?.[0].config?.presets).toBeDefined();
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
    expect(reglaConConteo(bajo, 2, 22)).toBe("Las 22 bajo 60%");
    expect(reglaConConteo(bajo, 1, 22)).toBe("Las 22 bajo 60%");
    expect(reglaConConteo(bajo, 2, null)).toBe("Bajo 60%");
    expect(reglaConConteo(bajo, 2, 0)).toBe("Ninguna bajo 60%");
    expect(reglaConConteo({ tipo: "mayor_diferencia", n: 10 }, 2, 1234)).toBe("Las 1,234 de mayor diferencia");
    expect(reglaConConteo({ tipo: "extremos", n: 5 }, 2, 10)).toBe("Las 5 más altas y las 5 más bajas");
    // H5: extremos también recibe el conteo; con menos candidatas que las pedidas, dice cuántas salen.
    expect(reglaConConteo({ tipo: "extremos", n: 5 }, 1, 6)).toBe("Las 6 entre las más altas y las más bajas");
    expect(reglaConConteo({ tipo: "extremos", n: 5 }, 1, 0)).toBe("Ninguna entre las más altas y las más bajas");
    expect(reglaConConteo(bajo, 3, 22)).not.toContain("algún público");
  });
});
