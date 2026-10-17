import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MaterialPreviewError,
  normalizeMaterialPreview,
  type MaterialPreview,
  type MaterialPreviewRequest,
} from "../../../api/materialPreview";
import {
  ESPERA_DE_VISTA_MS,
  clasificarFallo,
  claveDePedido,
  crearPlanificadorDeVista,
  type EstadoDeVista,
  type PedidoDeVista,
} from "./planificadorDeVista";
import { PREVIEW_CROQUIS_JSON, PREVIEW_FRENTE_JSON } from "./preview.fixture";

const FRENTE = normalizeMaterialPreview(PREVIEW_FRENTE_JSON);
const DORSO = normalizeMaterialPreview(PREVIEW_CROQUIS_JSON);

type Llamada = {
  request: MaterialPreviewRequest;
  signal: AbortSignal;
  resolver: (vista: MaterialPreview) => void;
  rechazar: (cause: unknown) => void;
};

function montar() {
  const llamadas: Llamada[] = [];
  const estados: EstadoDeVista[] = [];
  const listos: PedidoDeVista[] = [];
  const pedir = vi.fn((request: MaterialPreviewRequest, signal: AbortSignal) => new Promise<MaterialPreview>((resolve, reject) => {
    llamadas.push({ request, signal, resolver: resolve, rechazar: reject });
    signal.addEventListener("abort", () => {
      const e = new Error("abortado");
      e.name = "AbortError";
      reject(e);
    });
  }));
  const planificador = crearPlanificadorDeVista({
    pedir,
    alCambiar: (estado) => estados.push(estado),
    alListo: (pedido) => listos.push(pedido),
  });
  const ultimo = () => estados[estados.length - 1];
  return { planificador, pedir, llamadas, estados, listos, ultimo };
}

const pedido = (huella: string, page = 1, unidad: string | null = null): PedidoDeVista => ({
  clave: claveDePedido({ huella, unidad, page, dpi: 90 }),
  request: { page, unit_id: unidad, dpi: 90 },
});

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("una petición por ráfaga", () => {
  it("cinco ediciones seguidas piden la página una sola vez, tras la espera", async () => {
    const { planificador, pedir, llamadas, ultimo } = montar();
    for (const h of ["a", "b", "c", "d", "e"]) {
      planificador.solicitar(pedido(h));
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(pedir).not.toHaveBeenCalled();
    expect(ultimo().cargando).toBe(true);
    await vi.advanceTimersByTimeAsync(ESPERA_DE_VISTA_MS);
    expect(pedir).toHaveBeenCalledTimes(1);
    llamadas[0].resolver(FRENTE);
    await vi.advanceTimersByTimeAsync(0);
    expect(ultimo()).toMatchObject({ vista: FRENTE, claveDeVista: pedido("e").clave, cargando: false, fallo: null });
  });

  it("descarta la respuesta vieja aunque llegue después, y cancela su pedido", async () => {
    const { planificador, llamadas, ultimo } = montar();
    planificador.solicitar(pedido("a"), { inmediato: true });
    planificador.solicitar(pedido("b"), { inmediato: true });
    expect(llamadas[0].signal.aborted).toBe(true);
    llamadas[1].resolver(DORSO);
    await vi.advanceTimersByTimeAsync(0);
    llamadas[0].resolver(FRENTE);
    await vi.advanceTimersByTimeAsync(0);
    expect(ultimo().vista).toBe(DORSO);
    expect(ultimo().claveDeVista).toBe(pedido("b").clave);
  });

  it("volver a un borrador ya dibujado sale de la caché, sin pedir", async () => {
    const { planificador, pedir, llamadas, ultimo } = montar();
    planificador.solicitar(pedido("a"), { inmediato: true });
    llamadas[0].resolver(FRENTE);
    await vi.advanceTimersByTimeAsync(0);
    planificador.solicitar(pedido("b"), { inmediato: true });
    llamadas[1].resolver(DORSO);
    await vi.advanceTimersByTimeAsync(0);
    planificador.solicitar(pedido("a"));
    expect(ultimo()).toMatchObject({ vista: FRENTE, cargando: false });
    expect(pedir).toHaveBeenCalledTimes(2);
  });
});

describe("si falla, la imagen anterior se queda desactualizada", () => {
  it("un 422 conserva la página y trae los problemas", async () => {
    const { planificador, llamadas, ultimo } = montar();
    planificador.solicitar(pedido("a"), { inmediato: true });
    llamadas[0].resolver(FRENTE);
    await vi.advanceTimersByTimeAsync(0);
    planificador.solicitar(pedido("b"), { inmediato: true });
    llamadas[1].rechazar(new MaterialPreviewError("E_COLLECTION_MATERIAL_TEMPLATE_INVALID", "x", 422, {
      problems: [{ path: "p", code: "c", detail: "Margen fuera de rango.", page: 1, page_id: "ficha", block_id: "qr" }],
    }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ultimo()).toMatchObject({ vista: FRENTE, desactualizada: true, cargando: false });
    expect(ultimo().fallo?.tipo).toBe("invalida");
    expect(ultimo().fallo?.problemas[0]?.block_id).toBe("qr");
  });

  it("sin imagen previa no hay nada que marcar desactualizado", async () => {
    const { planificador, llamadas, ultimo } = montar();
    planificador.solicitar(pedido("a"), { inmediato: true });
    llamadas[0].rechazar(new MaterialPreviewError("E_COLLECTION_MATERIAL_PREVIEW_UNAVAILABLE", "x", 503, null));
    await vi.advanceTimersByTimeAsync(0);
    expect(ultimo()).toMatchObject({ vista: null, desactualizada: false });
    expect(ultimo().fallo?.tipo).toBe("no-disponible");
  });

  it("clasifica cada rechazo", () => {
    expect(clasificarFallo(new MaterialPreviewError("E_COLLECTION_MATERIAL_PREVIEW_UNIT", "x", 404, null)).tipo).toBe("unidad");
    expect(clasificarFallo(new MaterialPreviewError("E_COLLECTION_MATERIAL_PREVIEW_PAGE", "x", 422, null)).tipo).toBe("pagina");
    expect(clasificarFallo(new MaterialPreviewError("HTTP_503", "x", 503, null)).tipo).toBe("no-disponible");
    expect(clasificarFallo(new Error("se cayó la red"))).toEqual({ tipo: "error", mensaje: "se cayó la red", problemas: [] });
  });
});

describe("la otra cara, perezosa", () => {
  it("se precarga cuando la activa está lista, y se cancela si llega un pedido de verdad", async () => {
    const { planificador, llamadas, listos } = montar();
    planificador.solicitar(pedido("a", 1), { inmediato: true });
    llamadas[0].resolver(FRENTE);
    await vi.advanceTimersByTimeAsync(0);
    expect(listos).toHaveLength(1);
    planificador.precargar([pedido("a", 2)]);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[1].request.page).toBe(2);
    planificador.solicitar(pedido("b", 1));
    expect(llamadas[1].signal.aborted).toBe(true);
  });

  it("la cara precargada se abre sin pedir", async () => {
    const { planificador, pedir, llamadas, ultimo } = montar();
    planificador.precargar([pedido("a", 2)]);
    llamadas[0].resolver(DORSO);
    await vi.advanceTimersByTimeAsync(0);
    planificador.solicitar(pedido("a", 2));
    expect(ultimo().vista).toBe(DORSO);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("destruir corta la espera y lo que está en vuelo", async () => {
    const { planificador, pedir } = montar();
    planificador.solicitar(pedido("a"));
    planificador.destruir();
    await vi.advanceTimersByTimeAsync(ESPERA_DE_VISTA_MS * 2);
    expect(pedir).not.toHaveBeenCalled();
  });
});
