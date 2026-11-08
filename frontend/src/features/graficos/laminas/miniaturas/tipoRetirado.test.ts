// ADR 0137: una ranura con un tipo retirado sale en blanco a propósito. La miniatura lo dice («Tipo retirado») en vez
// de «Sin datos», que mandaría a buscar datos que no faltan.
import { describe, expect, it } from "vitest";
import { normalizeMiniaturasLote } from "../../../../api/graficosMiniaturas";
import { miniaturaDeEntrada, ERROR_TIPO_RETIRADO } from "../selectores/modeloMiniaturasSelector";
import { avisoVacios, fusionarLote, marcarPedidas } from "./loteMiniaturas";
import { rotuloEstado, vistaDeMiniatura } from "./vistaMiniatura";

const src = (url: string) => `${url}?sid=s`;
const vigente = { loteId: "l1", jobId: "j1", claves: { a: "a@1", b: "b@1" } };

function entradas(graficosA: Record<string, unknown>, estadoA = "sin_datos") {
  const lote = normalizeMiniaturasLote({
    lote_id: "l1", job_id: "j1", status: "done",
    laminas: [
      { slide_id: "a", estado: estadoA, miniatura: { file_id: "fa", url: "/api/files/fa/download" }, graficos: graficosA },
      { slide_id: "b", estado: "sin_datos", miniatura: { file_id: "fb", url: "/api/files/fb/download" }, graficos: { pedidos: 1, vacios: 1, motivo: ["n0"] } },
    ],
  });
  return fusionarLote(marcarPedidas({}, [{ id: "a", clave: "a@1" }, { id: "b", clave: "b@1" }]), lote, vigente, src);
}

describe("miniatura de un tipo retirado", () => {
  it("el motivo `tipo_retirado` (arreglo de R) marca la entrada; otro motivo no", () => {
    const e = entradas({ pedidos: 1, vacios: 1, motivo: ["tipo_retirado"] });
    expect(e.a.retirado).toBe(true);
    expect(e.b.retirado).toBeUndefined();
  });

  it("la tira dice «Tipo retirado», no «Sin datos», y lo anuncia", () => {
    const e = entradas({ pedidos: 1, vacios: 1, motivo: ["tipo_retirado"] });
    expect(vistaDeMiniatura(e.a, undefined).vista).toBe("retirado");
    expect(rotuloEstado("retirado")).toBe(", tipo de gráfico retirado");
    expect(vistaDeMiniatura(e.b, undefined).vista).toBe("sin_datos");
  });

  it("en una lámina que salió, el retirado no suma un «sin datos» parcial", () => {
    const e = entradas({ pedidos: 2, vacios: 1, motivo: ["tipo_retirado"] }, "ok");
    expect(avisoVacios(e.a)).toBeNull();
    expect(vistaDeMiniatura(e.a, undefined).vista).toBe("retirado");
  });

  it("en el selector, una entrada retirada es una nota propia", () => {
    const e = entradas({ pedidos: 1, vacios: 1, motivo: ["tipo_retirado"] });
    expect(miniaturaDeEntrada(e.a)).toEqual({ src: null, error: ERROR_TIPO_RETIRADO });
  });
});
