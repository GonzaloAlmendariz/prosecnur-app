// R12-6: la ranura de un tipo retirado (ADR 0137) no dibuja nada, así que su nombre y su aviso no se recortan.
import { describe, expect, it } from "vitest";
import type { FichaInfo } from "./fichaModelo";
import { cajaDe, escenaFicha } from "./geometriaFicha";

const retirada = (tipo: string): FichaInfo => ({
  graficador: "p_radar", tipo, lectura: null, preguntas: [], publicos: [], leyendas: [], ajustes: [],
  avisos: ["Tipo retirado: sale en blanco"], forma: null, glifo: {}, vacia: false, faltaPregunta: false, retirada: true,
});

describe("ficha de un tipo retirado", () => {
  // Ranura de «Cuatro gráficos» (≈ 6,1 × 2,6 in) y una estrecha de tres columnas (≈ 3,9 × 4,8 in).
  for (const [w, h] of [[6.1, 2.6], [3.9, 4.8]] as const) {
    it(`a ${w} × ${h} in: el aviso entero, el nombre en hasta dos renglones y nada fuera de la ficha`, () => {
      const e = escenaFicha(retirada("Diferencias significativas entre públicos"), w, h);
      expect(e.dibujo).toBeNull();
      const chip = e.piezas.find((p) => p.tipo === "chip");
      expect(chip && chip.tipo === "chip" ? chip.texto : null).toBe("Tipo retirado: sale en blanco");
      const cab = e.piezas.find((p) => p.tipo === "cabecera");
      const nombre = cab && cab.tipo === "cabecera" ? `${cab.texto} ${cab.texto2 ?? ""}`.trim() : "";
      expect(nombre).toBe("Diferencias significativas entre públicos");
      for (const p of e.piezas) {
        const c = cajaDe(p);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(w + 1e-9);
        expect(c.y + c.h).toBeLessThanOrEqual(h + 1e-9);
      }
    });
  }

  it("un nombre corto ocupa un renglón", () => {
    const cab = escenaFicha(retirada("Radar por dimensiones"), 6.1, 2.6).piezas.find((p) => p.tipo === "cabecera");
    expect(cab && cab.tipo === "cabecera" ? [cab.texto, cab.texto2] : null).toEqual(["Radar por dimensiones", undefined]);
  });
});
