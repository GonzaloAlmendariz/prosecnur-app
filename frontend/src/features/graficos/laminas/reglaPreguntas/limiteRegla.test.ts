// El chip del límite (limiteRegla.ts): la escala sale como imagen por más filas que el tope (optimista, conteo local) o
// por dos opciones «Sin información» (lo dice el motor con `cabe_nativa` y `motivo_imagen`, sin importar el corte).
import { describe, expect, it } from "vitest";
import { avisosFueraDelLimite, estadoLimite, otraCausaImagen } from "./limiteRegla";

const SIN_INF = "Hay dos opciones sin información; la lámina nativa admite una y la escala sale como imagen.";
const TOPE = "22 preguntas bajo 60%; la lámina nativa admite 20 y la escala sale como imagen.";
const OTRO = "3 preguntas quedan fuera: no forman un par comparable en las dos bases.";

describe("el chip del límite de la lámina nativa", () => {
  it("98/99 con 3 filas: aviso por la segunda causa, sin importar el corte", () => {
    const conteo = { avisos: [SIN_INF, OTRO], cabe_nativa: false, motivo_imagen: SIN_INF };
    const l = estadoLimite(conteo, 20, 3);
    expect(l).toEqual({ tope: 20, excedido: false, otraCausa: SIN_INF, aviso: true, texto: SIN_INF, titulo: SIN_INF });
    // Arrastrar el corte (otra selección local) no la apaga.
    expect(estadoLimite(conteo, 20, 1)?.aviso).toBe(true);
    expect(avisosFueraDelLimite(conteo.avisos, l)).toEqual([OTRO]);
  });

  it("22 filas: aviso por el tope, optimista con el conteo local", () => {
    const conteo = { avisos: [TOPE], cabe_nativa: false, motivo_imagen: TOPE };
    const l = estadoLimite(conteo, 20, 22);
    expect(l).toEqual({ tope: 20, excedido: true, otraCausa: null, aviso: true, texto: "La lámina nativa admite 20", titulo: TOPE });
    expect(otraCausaImagen(conteo)).toBeNull();
    // El motor todavía no responde y la selección local ya cabe: vuelve a neutro.
    expect(estadoLimite(conteo, 20, 18)).toMatchObject({ excedido: false, aviso: false });
    expect(avisosFueraDelLimite(conteo.avisos, l)).toEqual([]);
  });

  it("las dos causas: el chip dice la que no se deduce, el título lleva las dos y el tope sigue marcado", () => {
    const conteo = { avisos: [TOPE, SIN_INF], cabe_nativa: false, motivo_imagen: `${TOPE} ${SIN_INF}` };
    const l = estadoLimite(conteo, 20, 22);
    expect(l).toEqual({ tope: 20, excedido: true, otraCausa: SIN_INF, aviso: true, texto: SIN_INF, titulo: `${TOPE} ${SIN_INF}` });
    expect(avisosFueraDelLimite(conteo.avisos, l)).toEqual([]);
    // Con la selección local bajo el tope, la segunda causa mantiene el aviso.
    expect(estadoLimite(conteo, 20, 5)).toMatchObject({ excedido: false, aviso: true, texto: SIN_INF });
  });

  it("cabe_nativa null: no promete nada más que el tope", () => {
    expect(estadoLimite({ avisos: [], cabe_nativa: null, motivo_imagen: null }, null, 3)).toBeNull();
    expect(estadoLimite({ avisos: [], cabe_nativa: null, motivo_imagen: SIN_INF }, null, 3)).toBeNull();
    expect(estadoLimite({ avisos: [], cabe_nativa: null, motivo_imagen: null }, 20, 3))
      .toEqual({ tope: 20, excedido: false, otraCausa: null, aviso: false, texto: "La lámina nativa admite 20", titulo: null });
    expect(avisosFueraDelLimite([OTRO], null)).toEqual([OTRO]);
  });

  it("sin tope pero con la otra causa, el chip existe igual", () => {
    expect(estadoLimite({ avisos: [], cabe_nativa: false, motivo_imagen: SIN_INF }, null, 3))
      .toMatchObject({ tope: null, aviso: true, texto: SIN_INF, titulo: null });
  });
});
