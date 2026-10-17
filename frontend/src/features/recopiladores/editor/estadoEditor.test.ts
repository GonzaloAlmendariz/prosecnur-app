import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ESTADO_INICIAL_DEL_EDITOR, reducirEditor, type EstadoDelEditor } from "./estadoEditor";
import { actualizarBloque, hayCambiosSinGuardar } from "./modeloEditor";
import { TEMPLATE_FICHA_CAMPO } from "./preview.fixture";
import { guardarReceta } from "./useRecetaDelEditor";

function cargado(): EstadoDelEditor {
  return reducirEditor(ESTADO_INICIAL_DEL_EDITOR, { type: "carga-ok", template: TEMPLATE_FICHA_CAMPO });
}

describe("la receta en el editor", () => {
  it("editar marca cambios sin guardar; deshacer los quita", () => {
    let estado = cargado();
    const editada = actualizarBloque(TEMPLATE_FICHA_CAMPO, 0, "titulo", { max_lines: 1 });
    estado = reducirEditor(estado, { type: "editar", template: editada });
    expect(hayCambiosSinGuardar(estado.historia?.present ?? null, estado.guardada)).toBe(true);
    estado = reducirEditor(estado, { type: "deshacer" });
    expect(hayCambiosSinGuardar(estado.historia?.present ?? null, estado.guardada)).toBe(false);
    estado = reducirEditor(estado, { type: "rehacer" });
    expect(estado.historia?.present).toEqual(editada);
  });

  it("guardar fija la receta: la insignia se apaga y la historia empieza de nuevo", () => {
    let estado = reducirEditor(cargado(), { type: "editar", template: actualizarBloque(TEMPLATE_FICHA_CAMPO, 0, "titulo", { max_lines: 1 }) });
    estado = reducirEditor(estado, { type: "guardado-inicio" });
    expect(estado.guardando).toBe(true);
    const guardada = { ...estado.historia!.present, revision: 4, template_sha256: "sha256:nueva" };
    estado = reducirEditor(estado, { type: "guardado-ok", template: guardada, noop: false });
    expect(estado.guardando).toBe(false);
    expect(estado.historia?.past).toEqual([]);
    expect(hayCambiosSinGuardar(estado.historia!.present, estado.guardada)).toBe(false);
    expect(estado.aviso).toEqual({ tono: "ok", texto: "Receta guardada." });
  });

  it("un guardado sin cambios lo dice", () => {
    const estado = reducirEditor(cargado(), { type: "guardado-ok", template: TEMPLATE_FICHA_CAMPO, noop: true });
    expect(estado.aviso?.texto).toBe("No había cambios que guardar.");
  });

  it("pedir confirmación y cancelar no guardan nada", () => {
    let estado = reducirEditor(cargado(), { type: "pedir-confirmacion" });
    expect(estado.confirmando).toBe(true);
    estado = reducirEditor(estado, { type: "cancelar-guardado" });
    expect(estado).toMatchObject({ confirmando: false, guardando: false });
  });

  it("la unidad de prueba vive en el estado del editor", () => {
    const estado = reducirEditor(cargado(), { type: "unidad", unidad: "unit-ch1" });
    expect(estado.unidad).toBe("unit-ch1");
  });
});

describe("guardarReceta", () => {
  let enviado: { expected_revision: number; template: unknown } | null = null;
  let respuesta: () => Response;

  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    enviado = null;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      enviado = JSON.parse(String(init?.body));
      return respuesta();
    }));
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  const json = (body: unknown, status = 200) =>
    () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("manda el borrador con la revisión que la vista leyó", async () => {
    respuesta = json({ ok: true, template: { ...TEMPLATE_FICHA_CAMPO, revision: 4 }, state_revision: 13 });
    const accion = await guardarReceta(12, TEMPLATE_FICHA_CAMPO);
    expect(enviado?.expected_revision).toBe(12);
    expect(enviado?.template).toEqual(TEMPLATE_FICHA_CAMPO);
    expect(accion).toMatchObject({ type: "guardado-ok", noop: false });
  });

  it("lee el noop del backend", async () => {
    respuesta = json({ ok: true, noop: true, template: TEMPLATE_FICHA_CAMPO });
    expect(await guardarReceta(12, TEMPLATE_FICHA_CAMPO)).toMatchObject({ type: "guardado-ok", noop: true });
  });

  it("un 409 de estado viejo pide recargar en vez de pisar", async () => {
    respuesta = json({ error: { code: "E_COLLECTION_STATE_STALE", message: "stale" } }, 409);
    expect(await guardarReceta(12, TEMPLATE_FICHA_CAMPO)).toEqual({
      type: "guardado-error",
      texto: "Otro cambio del módulo se guardó antes. Vuelve a cargar la receta para no pisarlo.",
    });
  });
});
