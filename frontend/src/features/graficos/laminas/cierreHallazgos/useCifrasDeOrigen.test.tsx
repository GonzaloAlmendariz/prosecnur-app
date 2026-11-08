// «Elegir cifra» abre con N láminas de resumen y pide sus cifras en UN pedido de lote (POST /api/graficos/resumenes/cifras
// con `laminas`): Plumber atiende en serie y N pedidos sueltos hacían esperar N renders. La caché sigue por firma: dos
// orígenes con la misma lámina comparten entrada, una firma ya leída no se vuelve a pedir, y el error de una lámina queda
// en su grupo sin tumbar a las demás.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EntradaLoteCifras, PedidoCifrasLote } from "../../../../api/graficosCifras";

const pausa = vi.hoisted(() => ({ espera: null as Promise<void> | null }));
const lote = vi.hoisted(() => vi.fn(async (pedido: PedidoCifrasLote): Promise<Record<string, EntradaLoteCifras>> => {
  if (pausa.espera) await pausa.espera;
  const out: Record<string, EntradaLoteCifras> = {};
  for (const l of pedido.laminas) {
    out[l.id] = l.graficador === "p_roto"
      ? { cifras: { tipo: "", cifras: [], avisos: [] }, error: { code: "E_CIFRAS_INVALIDO", message: "El gráfico «p_roto» no publica cifras para el cierre." } }
      : { cifras: { tipo: `${l.graficador}/1`, cifras: [{ clave: `c:${String(l.args.n)}`, rotulo: "r", texto: "1", valor: 1, unidad: "" }], avisos: [] }, error: null };
  }
  return out;
}));
vi.mock("../../../../api/graficosCifras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../api/graficosCifras")>()),
  apiGraficosCifrasLote: lote,
}));

import { useCifrasDeOrigenes, type CifrasEnVivo } from "./useCifrasDeOrigen";

type Origen = { id: string; graficador: string; args: Record<string, unknown> };
let origenes: Origen[] = [];
let ultimo: Readonly<Record<string, CifrasEnVivo>> = {};
function Visor() {
  // Como el inspector: los args se re-arman en cada render.
  ultimo = useCifrasDeOrigenes(origenes.map((o) => ({ ...o, args: { ...o.args } })), "active");
  return null;
}

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; window?: unknown };
g.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof g.window === "undefined") g.window = { HTMLIFrameElement: class {} };
const doc = { nodeType: 9, documentElement: { namespaceURI: "http://www.w3.org/1999/xhtml" }, addEventListener: () => undefined, removeEventListener: () => undefined };
const contenedor = () => ({ nodeType: 1, tagName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml", ownerDocument: doc, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as Element;

let root: Root | null = null;
const drenar = async () => { for (let i = 0; i < 20; i += 1) await act(async () => { await Promise.resolve(); }); };
afterEach(() => { act(() => root?.unmount()); root = null; origenes = []; ultimo = {}; lote.mockClear(); pausa.espera = null; });

describe("useCifrasDeOrigenes", () => {
  it("N firmas que faltan van en un solo pedido; cada grupo sale cargando hasta que llega", async () => {
    origenes = [
      { id: "a", graficador: "p_cobertura", args: { n: 1 } },
      { id: "b", graficador: "p_panorama", args: { n: 2 } },
      { id: "c", graficador: "p_dumbbell", args: { n: 3 } },
      { id: "d", graficador: "p_cobertura", args: { n: 1 } },   // misma lámina que «a»: comparte la entrada
      { id: "e", graficador: "p_roto", args: { n: 5 } },
    ];
    let soltar = () => undefined as void;
    pausa.espera = new Promise<void>((r) => { soltar = r; });
    await act(async () => { root = createRoot(contenedor()); root.render(<Visor />); });
    await drenar();
    expect(ultimo.a).toEqual({ cifras: null, cargando: true, error: null });
    expect(ultimo.e).toEqual({ cifras: null, cargando: true, error: null });
    pausa.espera = null;
    soltar();
    await drenar();
    expect(lote).toHaveBeenCalledTimes(1);
    expect(lote.mock.calls[0][0].laminas).toHaveLength(4);
    expect(lote.mock.calls[0][0].scope).toBeUndefined();
    expect(ultimo.a.cargando).toBe(false);
    expect(ultimo.a.cifras?.cifras[0].clave).toBe("c:1");
    expect(ultimo.d.cifras).toBe(ultimo.a.cifras);
    expect(ultimo.c.cifras?.tipo).toBe("p_dumbbell/1");
    expect(ultimo.e).toEqual({ cifras: null, cargando: false, error: "El gráfico «p_roto» no publica cifras para el cierre." });
    // Re-render con lo mismo: no vuelve a pedir.
    await act(async () => { root?.render(<Visor />); });
    await drenar();
    expect(lote).toHaveBeenCalledTimes(1);
  });

  it("al sumar láminas pide sólo las firmas que faltan, en un pedido; las leídas salen de la caché", async () => {
    origenes = [{ id: "a", graficador: "p_fortalezas", args: { n: 10 } }];
    await act(async () => { root = createRoot(contenedor()); root.render(<Visor />); });
    await drenar();
    expect(lote).toHaveBeenCalledTimes(1);
    origenes = [...origenes, { id: "b", graficador: "p_fortalezas", args: { n: 11 } }, { id: "c", graficador: "p_fortalezas", args: { n: 12 } }];
    await act(async () => { root?.render(<Visor />); });
    await drenar();
    expect(lote).toHaveBeenCalledTimes(2);
    expect(lote.mock.calls[1][0].laminas.map((l) => l.args.n)).toEqual([11, 12]);
    expect(ultimo.a.cifras?.cifras[0].clave).toBe("c:10");
    expect(ultimo.c.cifras?.cifras[0].clave).toBe("c:12");
  });
});
