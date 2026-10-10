import { describe, expect, it } from "vitest";
import type { PreviewSlideResponse } from "../../api/graficos";
import { clavePreview, crearCoordinadorPreviewLamina, estaDesactualizada, type EstadoPreviewLamina } from "./previewLaminaCoordinador";

const resp = (id: string) => ({ ok: true, file_id: id, size: 1, type: "pptx", images: [] }) as PreviewSlideResponse;

function temporizadorManual() {
  const tareas = new Map<number, () => void>();
  let n = 0;
  return {
    t: { programar: (fn: () => void) => (tareas.set(++n, fn), n), cancelar: (id: unknown) => tareas.delete(id as number) },
    correr: () => { const fs = [...tareas.values()]; tareas.clear(); fs.forEach((f) => f()); },
    pendientes: () => tareas.size,
  };
}

describe("vista previa de la lámina: debounce, cancelación y desactualizada (F6.0b.2)", () => {
  it("varios cambios seguidos piden una sola vista previa, la del último", async () => {
    const pedidas: string[] = [];
    const tm = temporizadorManual();
    const c = crearCoordinadorPreviewLamina(async (clave) => (pedidas.push(clave), resp(clave)), { temporizador: tm.t });
    const estados: EstadoPreviewLamina[] = [];
    c.solicitar("a", (e) => estados.push(e)); c.solicitar("b", (e) => estados.push(e)); const fin = c.solicitar("c", (e) => estados.push(e));
    expect(tm.pendientes()).toBe(1);
    tm.correr(); await fin;
    expect(pedidas).toEqual(["c"]);
    expect(estados.at(-1)).toMatchObject({ estado: "lista", clave: "c" });
  });

  it("aborta la solicitud en curso y descarta su respuesta tardía; mientras tanto la imagen vieja se ve desactualizada", async () => {
    const tm = temporizadorManual();
    const pendientes: Array<{ clave: string; signal: AbortSignal; resolver: (r: PreviewSlideResponse) => void }> = [];
    const c = crearCoordinadorPreviewLamina((clave, { signal }) => new Promise((resolver) => pendientes.push({ clave, signal, resolver })), { temporizador: tm.t });
    const estados: EstadoPreviewLamina[] = [];
    const p1 = c.solicitar("v1", (e) => estados.push(e)); tm.correr();
    pendientes[0]!.resolver(resp("v1")); await p1;
    const p2 = c.solicitar("v2", (e) => estados.push(e)); tm.correr();
    expect(estaDesactualizada(estados.at(-1)!)).toBe(true);             // cargando v2 con la imagen de v1 visible
    const p3 = c.solicitar("v3", (e) => estados.push(e));
    expect(pendientes[1]!.signal.aborted).toBe(true);
    tm.correr();
    pendientes[2]!.resolver(resp("v3")); await p3;
    pendientes[1]!.resolver(resp("v2-tardia")); await p2;
    expect(estados.at(-1)).toMatchObject({ estado: "lista", clave: "v3" });
    expect(estados.some((e) => e.estado === "lista" && e.clave === "v2")).toBe(false);
  });

  it("la misma lámina sin cambios no vuelve a pedir; la clave no depende del orden de las propiedades", async () => {
    let pedidas = 0;
    const tm = temporizadorManual();
    const c = crearCoordinadorPreviewLamina(async (clave) => (pedidas++, resp(clave)), { temporizador: tm.t });
    const k1 = clavePreview({ slide: { id: "s1", payload: { titulo: "A", meta: { nivel: "capitulo" } } }, config: { x: 1 } });
    const k2 = clavePreview({ config: { x: 1 }, slide: { payload: { meta: { nivel: "capitulo" }, titulo: "A" }, id: "s1" } });
    expect(k1).toBe(k2);
    const p = c.solicitar(k1, () => {}); tm.correr(); await p;
    await c.solicitar(k2, () => {});
    expect(pedidas).toBe(1);
  });

  it("un error conserva la imagen anterior como desactualizada", async () => {
    const tm = temporizadorManual();
    let falla = false;
    const c = crearCoordinadorPreviewLamina(async (clave) => { if (falla) throw new Error("E_PREVIEW_FAILED"); return resp(clave); }, { temporizador: tm.t });
    const p = c.solicitar("a", () => {}); tm.correr(); await p;
    falla = true;
    let ultimo: EstadoPreviewLamina = { estado: "inactiva" };
    const q = c.solicitar("b", (e) => (ultimo = e)); tm.correr(); await q;
    expect(ultimo).toMatchObject({ estado: "error", mensaje: "E_PREVIEW_FAILED" });
    expect(estaDesactualizada(ultimo)).toBe(true);
  });
});
