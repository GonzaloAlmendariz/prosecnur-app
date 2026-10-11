import { describe, expect, it } from "vitest";
import { miniaturaSrc, normalizeMiniaturasLote, normalizeMiniaturasLoteStart, normalizePreviewSlideJobStart } from "./graficosMiniaturas";

describe("normalizePreviewSlideJobStart", () => {
  it("lee el arranque del job de vista previa", () => {
    expect(normalizePreviewSlideJobStart({
      ok: true, job_id: "j1", lote_id: "l1", kind: "graficos.preview_slide", total: 1, en_cache: 0, pendientes: 1, hash: "abc", slide_id: "s-1",
    })).toEqual({ ok: true, job_id: "j1", lote_id: "l1", kind: "graficos.preview_slide", total: 1, en_cache: 0, pendientes: 1, hash: "abc", slide_id: "s-1" });
  });

  it("tolera NULL de R como {} y números como texto", () => {
    expect(normalizePreviewSlideJobStart({ job_id: "j1", lote_id: {}, total: "1", hash: {} })).toMatchObject({ lote_id: "", total: 1, hash: null, slide_id: null });
  });

  it("sin job_id no hay nada que pollear", () => {
    expect(() => normalizePreviewSlideJobStart({ ok: true })).toThrow(/trabajo/);
    expect(() => normalizeMiniaturasLoteStart(null)).toThrow();
  });
});

describe("normalizeMiniaturasLote", () => {
  const lote = {
    ok: true,
    lote_id: "l1",
    job_id: "j1",
    status: "running",
    total: 4,
    conteo: { ok: 1, sin_datos: 1, sin_imagen: 0, error: 1, pendiente: 1 },
    laminas: [
      { slide_id: "a", orden: 1, hash: "h1", estado: "ok", folio: 3, cache: { pptx: "hit", raster: "miss" },
        miniatura: { file_id: "f1", url: "/api/files/f1/download", mime: "image/png", width: 1600, height: 900, sha256: "x" }, avisos: "una", error: {} },
      { slide_id: "b", orden: 2, estado: "sin_datos", miniatura: {}, avisos: {}, error: {} },
      { slide_id: "c", orden: 3, estado: "error", miniatura: {}, error: { code: "E_MINIATURA_FALLIDA", message: "falló" } },
      { slide_id: "d", orden: 4, estado: "pendiente", miniatura: {} },
    ],
  };

  it("normaliza cada lámina según su estado", () => {
    const r = normalizeMiniaturasLote(lote);
    expect(r.status).toBe("running");
    expect(r.total).toBe(4);
    expect(r.conteo).toEqual({ ok: 1, sin_datos: 1, sin_imagen: 0, error: 1, pendiente: 1 });
    expect(r.laminas.map((l) => l.estado)).toEqual(["ok", "sin_datos", "error", "pendiente"]);
    expect(r.laminas[0]).toMatchObject({ folio: 3, avisos: ["una"], miniatura: { file_id: "f1", width: 1600 }, error: null });
    expect(r.laminas[1].miniatura).toBeNull();
    expect(r.laminas[1].avisos).toEqual([]);
    expect(r.laminas[2].error).toEqual({ code: "E_MINIATURA_FALLIDA", message: "falló" });
  });

  it("una lámina «ok» sin imagen se degrada a sin_imagen y un estado desconocido no se vuelve ok", () => {
    const r = normalizeMiniaturasLote({ laminas: [{ slide_id: "a", estado: "ok", miniatura: {} }, { slide_id: "b", estado: "raro" }] });
    expect(r.laminas.map((l) => l.estado)).toEqual(["sin_imagen", "pendiente"]);
  });

  it("descarta láminas sin id, cuenta si falta el conteo y acepta una sola lámina como objeto", () => {
    const r = normalizeMiniaturasLote({ status: "done", laminas: { slide_id: "a", estado: "ok", miniatura: { file_id: "f" } } });
    expect(r.laminas).toHaveLength(1);
    expect(r.laminas[0].miniatura?.url).toBe("/api/files/f/download");
    expect(r.conteo.ok).toBe(1);
    expect(normalizeMiniaturasLote({ laminas: [{ estado: "ok" }] }).laminas).toEqual([]);
    expect(normalizeMiniaturasLote({ status: "perdido" }).status).toBe("running");
  });
});

describe("miniaturaSrc", () => {
  it("agrega el sid en la query (un <img> no manda headers)", () => {
    expect(miniaturaSrc({ url: "/api/files/f1/download" }, "s 1")).toMatch(/\/api\/files\/f1\/download\?sid=s%201$/);
    expect(miniaturaSrc({ url: "/api/files/f1/download?x=1" }, "s")).toMatch(/\?x=1&sid=s$/);
    expect(miniaturaSrc({ url: "/api/files/f1/download?sid=a" }, "b")).toMatch(/\?sid=a$/);
    expect(miniaturaSrc({ url: "/api/files/f1/download" }, null)).toMatch(/\/download$/);
  });
});

describe("graficos por lámina (campo aditivo, opcional)", () => {
  it("lee pedidos/vacíos/motivo, acota vacíos e ignora claves desconocidas", () => {
    const r = normalizeMiniaturasLote({ laminas: [
      { slide_id: "a", estado: "ok", miniatura: { file_id: "f" }, graficos: { pedidos: 2, vacios: 5, motivo: "n=0", otro: 1 } },
      { slide_id: "b", estado: "ok", miniatura: { file_id: "g" } },
      { slide_id: "c", estado: "ok", miniatura: { file_id: "h" }, graficos: {} },
    ] });
    expect(r.laminas[0].graficos).toEqual({ pedidos: 2, vacios: 2, motivo: "n=0" });
    expect(r.laminas[1].graficos).toBeNull();
    expect(r.laminas[2].graficos).toBeNull();
  });
});
