import { beforeEach, describe, expect, it } from "vitest";
import type { MiniaturasLote } from "../../../../api/graficosMiniaturas";
import { useMiniaturasLoteStore } from "../miniaturas/miniaturasStore";
import { useMiniaturasMazoStore } from "./miniaturasMazoStore";

const lote = (status: MiniaturasLote["status"], estado: "ok" | "pendiente"): MiniaturasLote => ({
  lote_id: "L1", status, total: 1, conteo: { pendiente: 0, ok: 1, sin_imagen: 0, sin_datos: 0, error: 0 },
  laminas: [{ slide_id: "mazo-panorama", estado, miniatura: estado === "ok" ? { file_id: "f", url: "/u.png", mime: "image/png", width: null, height: null, sha256: null } : null, imagen: null, error: null, graficos: null, motivo_sin_imagen: null }],
} as unknown as MiniaturasLote);

describe("store de miniaturas del mazo", () => {
  beforeEach(() => { useMiniaturasMazoStore.getState().reiniciar(); useMiniaturasLoteStore.getState().reiniciar(); });

  it("pide, recibe el lote y pinta; la tira no se entera", () => {
    const s = useMiniaturasMazoStore.getState();
    s.pedir([{ id: "mazo-panorama", clave: "k" }]);
    s.iniciarLote({ loteId: "L1", jobId: "J1", claves: { "mazo-panorama": "k" } });
    useMiniaturasMazoStore.getState().aplicarLote(lote("done", "ok"), (u) => `src:${u}`);
    const st = useMiniaturasMazoStore.getState();
    expect(st.entradas["mazo-panorama"]).toMatchObject({ estado: "ok", src: "src:/u.png" });
    expect(st.lotes).toEqual([]);
    expect(useMiniaturasLoteStore.getState().entradas).toEqual({});
  });

  it("al cerrar el mazo suelta sus lotes y devuelve los jobs a cancelar; los pendientes se vuelven a pedir", () => {
    const s = useMiniaturasMazoStore.getState();
    s.pedir([{ id: "mazo-panorama", clave: "k" }]);
    s.iniciarLote({ loteId: "L1", jobId: "J1", claves: { "mazo-panorama": "k" } });
    expect(useMiniaturasMazoStore.getState().abandonarLotes()).toEqual(["J1"]);
    expect(useMiniaturasMazoStore.getState().entradas).toEqual({});
  });
});
