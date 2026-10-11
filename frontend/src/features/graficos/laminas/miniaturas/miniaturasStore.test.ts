import { beforeEach, describe, expect, it } from "vitest";
import { normalizeMiniaturasLote } from "../../../../api/graficosMiniaturas";
import { useMiniaturasLoteStore } from "./miniaturasStore";

const src = (u: string) => u;
const ok = (id: string) => ({ slide_id: id, estado: "ok", miniatura: { file_id: `f-${id}` } });

describe("miniaturasStore (reemplazo y cancelación)", () => {
  beforeEach(() => useMiniaturasLoteStore.getState().reiniciar());

  it("un lote reemplazado ya no escribe; el vigente sí y se suelta al terminar", () => {
    const s = useMiniaturasLoteStore.getState();
    s.pedir([{ id: "a", clave: "a1" }, { id: "b", clave: "b1" }]);
    expect(useMiniaturasLoteStore.getState().enVuelo).toBe(true);
    s.iniciarLote({ loteId: "l1", jobId: "j1", claves: { a: "a1", b: "b1" } });
    s.pedir([{ id: "a", clave: "a2" }, { id: "b", clave: "b1" }]);
    s.iniciarLote({ loteId: "l2", jobId: "j2", claves: { a: "a2", b: "b1" } }, { reemplazo: true });
    s.aplicarLote(normalizeMiniaturasLote({ lote_id: "l1", status: "cancelled", laminas: [ok("a"), { slide_id: "b", estado: "pendiente" }] }), src);
    expect(useMiniaturasLoteStore.getState().entradas.b.estado).toBe("pendiente");
    s.aplicarLote(normalizeMiniaturasLote({ lote_id: "l2", status: "done", laminas: [ok("a"), ok("b")] }), src);
    const st = useMiniaturasLoteStore.getState();
    expect(st.entradas.a).toMatchObject({ estado: "ok", clave: "a2" });
    expect(st.vigente).toBeNull();
  });

  it("un lote que no reemplaza convive con el en curso: ambos escriben y se sueltan por separado", () => {
    const s = useMiniaturasLoteStore.getState();
    s.pedir([{ id: "a", clave: "a1" }, { id: "b", clave: "b1" }]);
    s.iniciarLote({ loteId: "l1", jobId: "j1", claves: { a: "a1", b: "b1" } });
    s.pedir([{ id: "c", clave: "c1" }]);
    s.iniciarLote({ loteId: "l2", jobId: "j2", claves: { c: "c1" } });
    expect(useMiniaturasLoteStore.getState().lotes.map((l) => l.loteId)).toEqual(["l1", "l2"]);
    expect(Object.keys(useMiniaturasLoteStore.getState().vigente?.claves ?? {}).sort()).toEqual(["a", "b", "c"]);
    s.aplicarLote(normalizeMiniaturasLote({ lote_id: "l2", status: "done", laminas: [ok("c")] }), src);
    s.aplicarLote(normalizeMiniaturasLote({ lote_id: "l1", status: "running", laminas: [ok("a"), { slide_id: "b", estado: "pendiente" }] }), src);
    const st = useMiniaturasLoteStore.getState();
    expect(st.entradas.c.estado).toBe("ok");
    expect(st.entradas.a.estado).toBe("ok");
    expect(st.entradas.b.estado).toBe("pendiente");
    expect(st.lotes.map((l) => l.loteId)).toEqual(["l1"]);
    s.fallar({ a: "a1", b: "b1" }, "caído", "l1");
    expect(useMiniaturasLoteStore.getState().entradas.b.estado).toBe("error");
    expect(useMiniaturasLoteStore.getState().vigente).toBeNull();
  });

  it("abandonar suelta los lotes, devuelve sus jobs y olvida las pendientes", () => {
    const s = useMiniaturasLoteStore.getState();
    s.pedir([{ id: "a", clave: "a1" }, { id: "b", clave: "b1" }]);
    s.iniciarLote({ loteId: "l1", jobId: "j1", claves: { a: "a1", b: "b1" } });
    s.pedir([{ id: "c", clave: "c1" }]);
    s.iniciarLote({ loteId: "l2", jobId: "j2", claves: { c: "c1" } });
    s.aplicarLote(normalizeMiniaturasLote({ lote_id: "l1", status: "running", laminas: [ok("a")] }), src);
    expect(useMiniaturasLoteStore.getState().abandonarLotes()).toEqual(["j1", "j2"]);
    expect(Object.keys(useMiniaturasLoteStore.getState().entradas)).toEqual(["a"]);
    expect(useMiniaturasLoteStore.getState().abandonarLotes()).toEqual([]);
  });

  it("reintentar marca la lámina como forzada hasta que se vuelve a pedir", () => {
    const s = useMiniaturasLoteStore.getState();
    s.reintentar("a");
    expect(useMiniaturasLoteStore.getState().forzadas).toEqual({ a: true });
    s.pedir([{ id: "a", clave: "a1" }]);
    expect(useMiniaturasLoteStore.getState().forzadas).toEqual({});
  });
});
