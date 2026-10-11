import { describe, expect, it } from "vitest";
import { ANUNCIO_INICIAL, siguienteAnuncio } from "./anuncioTira";
import type { Entradas, EntradaMiniatura, LoteVigente } from "./loteMiniaturas";

const e = (estado: EntradaMiniatura["estado"], clave: string): EntradaMiniatura => ({ estado, clave, src: null, anterior: null, error: null });
const ids = Array.from({ length: 67 }, (_, i) => `s${i + 1}`);
const vigente: LoteVigente = { loteId: "l1", jobId: "j1", claves: Object.fromEntries(ids.map((id) => [id, `${id}@1`])) };
const todas = (estado: (i: number) => EntradaMiniatura["estado"]): Entradas =>
  Object.fromEntries(ids.map((id, i) => [id, e(estado(i), `${id}@1`)]));

describe("anuncio de la tira de miniaturas", () => {
  it("un solo texto mientras el lote corre, aunque lleguen láminas una a una (no 67 anuncios)", () => {
    const textos = new Set<string>();
    let a = ANUNCIO_INICIAL;
    for (let k = 0; k < 67; k += 1) {
      a = siguienteAnuncio(a, vigente, todas((i) => (i < k ? "ok" : "pendiente")));
      textos.add(a.texto);
    }
    expect([...textos]).toEqual(["Dibujando 67 miniaturas"]);
  });

  it("al terminar (el lote vigente desaparece del store) dice «Miniaturas listas: M de M», y lo sostiene", () => {
    let a = siguienteAnuncio(ANUNCIO_INICIAL, vigente, todas(() => "pendiente"));
    a = siguienteAnuncio(a, null, todas(() => "ok"));
    expect(a.texto).toBe("Miniaturas listas: 67 de 67");
    expect(siguienteAnuncio(a, null, todas(() => "ok"))).toBe(a);
  });

  it("cuenta las que fallaron en vez de darlas por listas", () => {
    let a = siguienteAnuncio(ANUNCIO_INICIAL, vigente, todas(() => "pendiente"));
    a = siguienteAnuncio(a, null, todas((i) => (i < 2 ? "error" : "ok")));
    expect(a.texto).toBe("Miniaturas listas: 65 de 67; 2 no se pudieron dibujar");
  });

  it("es idempotente bajo el doble render de StrictMode y no anuncia nada sin lote", () => {
    expect(siguienteAnuncio(ANUNCIO_INICIAL, null, {})).toBe(ANUNCIO_INICIAL);
    const a = siguienteAnuncio(ANUNCIO_INICIAL, vigente, todas(() => "pendiente"));
    expect(siguienteAnuncio(a, vigente, todas(() => "pendiente"))).toBe(a);
  });

  it("un reintento de una lámina se anuncia en singular", () => {
    const uno: LoteVigente = { loteId: "l2", jobId: "j2", claves: { s1: "s1@1" } };
    const a = siguienteAnuncio(ANUNCIO_INICIAL, uno, { s1: e("pendiente", "s1@1") });
    expect(a.texto).toBe("Dibujando 1 miniatura");
    expect(siguienteAnuncio(a, null, { s1: e("ok", "s1@1") }).texto).toBe("Miniaturas listas: 1 de 1");
  });
});
