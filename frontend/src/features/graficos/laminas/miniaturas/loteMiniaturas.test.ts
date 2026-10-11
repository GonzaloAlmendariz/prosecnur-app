import { describe, expect, it } from "vitest";
import { normalizeMiniaturasLote, type MiniaturasLote } from "../../../../api/graficosMiniaturas";
import {
  avanceLote, avisoVacios, fallarLote, fusionarLote, laminasAPedir, marcarPedidas, mensajeLegible, MENSAJE_INTERRUMPIDA, olvidarPendientes,
  type Entradas, type LoteVigente,
} from "./loteMiniaturas";

const src = (url: string) => `${url}?sid=s`;
const L = (id: string, clave = `${id}@1`) => ({ id, clave });

function lote(status: MiniaturasLote["status"], laminas: Array<Record<string, unknown>>): MiniaturasLote {
  return normalizeMiniaturasLote({ lote_id: "l1", job_id: "j1", status, laminas });
}
const ok = (id: string) => ({ slide_id: id, estado: "ok", miniatura: { file_id: `f-${id}`, url: `/api/files/f-${id}/download` } });

describe("laminasAPedir", () => {
  const laminas = [L("a"), L("b"), L("c")];

  it("sin entradas pide todas, en orden", () => {
    expect(laminasAPedir(laminas, {}, { loteCorriendo: false })).toEqual(laminas);
  });

  it("al editar una lámina pide sólo ésa más las pendientes del lote que va a reemplazar", () => {
    let e = marcarPedidas({}, laminas);
    e = fusionarLote(e, lote("running", [ok("a")]), { loteId: "l1", jobId: "j1", claves: Object.fromEntries(laminas.map((l) => [l.id, l.clave])) }, src);
    const editado = [L("a", "a@2"), L("b"), L("c")];
    expect(laminasAPedir(editado, e, { loteCorriendo: true })).toEqual([L("a", "a@2"), L("b"), L("c")]);
    // Si la editada es una ya resuelta y no hay pendientes, sólo viaja ésa.
    const resueltas = fusionarLote(e, lote("done", [ok("a"), ok("b"), ok("c")]), { loteId: "l1", jobId: "j1", claves: { a: "a@1", b: "b@1", c: "c@1" } }, src);
    expect(laminasAPedir([L("a"), L("b", "b@2"), L("c")], resueltas, { loteCorriendo: false })).toEqual([L("b", "b@2")]);
  });

  it("sin cambios y con lote corriendo no pide nada; sin lote, retoma las pendientes", () => {
    const e = marcarPedidas({}, laminas);
    expect(laminasAPedir(laminas, e, { loteCorriendo: true })).toEqual([]);
    expect(laminasAPedir(laminas, e, { loteCorriendo: false })).toEqual(laminas);
  });

  it("los errores no se reintentan solos, sí al forzar o al editar", () => {
    const e = fallarLote(marcarPedidas({}, laminas), { claves: { a: "a@1", b: "b@1", c: "c@1" } }, "x");
    expect(laminasAPedir(laminas, e, { loteCorriendo: false })).toEqual([]);
    expect(laminasAPedir(laminas, e, { loteCorriendo: false, forzar: new Set(["b"]) })).toEqual([L("b")]);
    expect(laminasAPedir([L("a"), L("b"), L("c", "c@2")], e, { loteCorriendo: false })).toEqual([L("c", "c@2")]);
  });
});

describe("fusionarLote", () => {
  const vigente: LoteVigente = { loteId: "l1", jobId: "j1", claves: { a: "a@1", b: "b@1", c: "c@1", d: "d@1", e: "e@1" } };
  const base = marcarPedidas({}, [L("a"), L("b"), L("c"), L("d"), L("e")]);

  it("pinta cada lámina por estado conforme llega, también a medias", () => {
    const r = fusionarLote(base, lote("running", [
      ok("a"),
      { slide_id: "b", estado: "sin_imagen" },
      { slide_id: "c", estado: "sin_datos", miniatura: { url: "/api/files/x/download" } },
      { slide_id: "d", estado: "error", error: { code: "E_MINIATURA_FALLIDA", message: "E_MINIATURA_FALLIDA: el motor falló" } },
      { slide_id: "e", estado: "pendiente" },
    ]), vigente, src);
    expect(r.a).toMatchObject({ estado: "ok", src: "/api/files/f-a/download?sid=s" });
    expect(r.b).toMatchObject({ estado: "sin_imagen", src: null });
    expect(r.c).toMatchObject({ estado: "sin_datos", src: "/api/files/x/download?sid=s" });
    expect(r.d).toMatchObject({ estado: "error", error: "el motor falló" });
    expect(r.e.estado).toBe("pendiente");
  });

  it("un lote viejo no pisa una lámina editada después", () => {
    const editada = marcarPedidas(base, [L("a", "a@2")]);
    const r = fusionarLote(editada, lote("running", [ok("a")]), vigente, src);
    expect(r.a).toMatchObject({ estado: "pendiente", clave: "a@2" });
  });

  it("al terminar, lo que siga pendiente queda como error reintentable", () => {
    const r = fusionarLote(base, lote("cancelled", [ok("a"), { slide_id: "b", estado: "pendiente" }]), vigente, src);
    expect(r.b).toMatchObject({ estado: "error", error: MENSAJE_INTERRUMPIDA });
    expect(r.c).toMatchObject({ estado: "error", error: MENSAJE_INTERRUMPIDA });
  });

  it("sin cambios devuelve el mismo objeto (la tira no re-renderiza en cada poll)", () => {
    const r1 = fusionarLote(base, lote("running", [ok("a")]), vigente, src);
    expect(fusionarLote(r1, lote("running", [ok("a")]), vigente, src)).toBe(r1);
  });

  it("al rehacer conserva la imagen previa como «anterior» y la suelta al llegar la nueva", () => {
    const r1 = fusionarLote(base, lote("done", [ok("a")]), vigente, src);
    const re = marcarPedidas(r1, [L("a", "a@2")]);
    expect(re.a).toMatchObject({ estado: "pendiente", src: null, anterior: "/api/files/f-a/download?sid=s" });
    const r2 = fusionarLote(re, lote("running", [ok("a")]), { loteId: "l1", jobId: "j1", claves: { a: "a@2" } }, src);
    expect(r2.a).toMatchObject({ estado: "ok", anterior: null });
  });
});

describe("fallarLote, olvidarPendientes y avance", () => {
  it("un fallo del pedido entero marca sólo las pendientes de ese pedido", () => {
    const e: Entradas = fusionarLote(marcarPedidas({}, [L("a"), L("b")]), lote("running", [ok("a")]), { loteId: "l1", jobId: "j1", claves: { a: "a@1", b: "b@1" } }, src);
    const r = fallarLote(e, { claves: { a: "a@1", b: "b@1" } }, "Backend caído · E_INTERNAL");
    expect(r.a.estado).toBe("ok");
    expect(r.b).toMatchObject({ estado: "error", error: "Backend caído" });
  });

  it("olvidarPendientes suelta las pendientes y conserva lo resuelto", () => {
    const e = fusionarLote(marcarPedidas({}, [L("a"), L("b")]), lote("running", [ok("a")]), { loteId: "l1", jobId: "j1", claves: { a: "a@1", b: "b@1" } }, src);
    const r = olvidarPendientes(e, { a: "a@1", b: "b@1" });
    expect(Object.keys(r)).toEqual(["a"]);
  });

  it("avanceLote cuenta las resueltas del lote vigente", () => {
    const vigente: LoteVigente = { loteId: "l1", jobId: "j1", claves: { a: "a@1", b: "b@1", c: "c@1" } };
    const e = fusionarLote(marcarPedidas({}, [L("a"), L("b"), L("c")]), lote("running", [ok("a")]), vigente, src);
    expect(avanceLote(e, vigente)).toEqual({ listas: 1, total: 3 });
    expect(avanceLote(e, null)).toBeNull();
  });

  it("mensajeLegible quita los códigos", () => {
    expect(mensajeLegible("No se pudo · E_PREVIEW_FAILED")).toBe("No se pudo");
    expect(mensajeLegible("E_MINIATURA_FALLIDA")).toBe("No se pudo dibujar la miniatura.");
    expect(mensajeLegible(null)).toBe("No se pudo dibujar la miniatura.");
  });
});

describe("gráficos vacíos (aditivo del backend)", () => {
  const vigente: LoteVigente = { loteId: "l1", jobId: "j1", claves: { a: "a@1", b: "b@1" } };
  it("una lámina parcial lleva el aviso «1 de 2»; sin el campo, nada", () => {
    const e = fusionarLote(marcarPedidas({}, [L("a"), L("b")]), lote("running", [
      { ...ok("a"), graficos: { pedidos: 2, vacios: 1, motivo: "variable fuera de la base", desconocido: true } },
      ok("b"),
    ]), vigente, src);
    expect(avisoVacios(e.a)).toBe("1 de 2 gráficos sin datos");
    expect(e.a.vacios?.motivo).toBe("variable fuera de la base");
    expect(avisoVacios(e.b)).toBeNull();
    expect(avisoVacios(undefined)).toBeNull();
  });
});
