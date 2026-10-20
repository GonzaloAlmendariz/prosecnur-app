import { describe, expect, it } from "vitest";
import { altoMaximoCondicion, anchoCondicion, encajarCondicion, posicionInicialCondicion } from "./posicionCondicion";

describe("posicionCondicion", () => {
  it("abre abajo a la derecha del punto cuando cabe", () => {
    expect(posicionInicialCondicion({ x: 100, y: 100, ancho: 360, alto: 300, vw: 1440, vh: 1000 })).toEqual({ left: 112, top: 112 });
  });

  it("se voltea a la izquierda y arriba cerca del borde", () => {
    expect(posicionInicialCondicion({ x: 1300, y: 900, ancho: 360, alto: 300, vw: 1440, vh: 1000 })).toEqual({ left: 928, top: 588 });
  });

  it("nunca queda fuera de la ventana compacta", () => {
    const caja = posicionInicialCondicion({ x: 500, y: 300, ancho: 360, alto: 560, vw: 1024, vh: 600 });
    expect(caja.top).toBeGreaterThanOrEqual(16);
    expect(caja.top + 560).toBeLessThanOrEqual(600 - 16 + 1);
    expect(caja.left + 360).toBeLessThanOrEqual(1024 - 16);
  });

  it("al arrastrar se queda dentro de la ventana", () => {
    expect(encajarCondicion({ left: -200, top: -50, ancho: 360, alto: 400, vw: 1024, vh: 600 })).toEqual({ left: 16, top: 16 });
    expect(encajarCondicion({ left: 5000, top: 5000, ancho: 360, alto: 400, vw: 1024, vh: 600 })).toEqual({ left: 648, top: 184 });
  });

  it("acota alto y ancho a la ventana", () => {
    expect(altoMaximoCondicion(1000)).toBe(560);
    expect(altoMaximoCondicion(600)).toBe(560);
    expect(altoMaximoCondicion(400)).toBe(368);
    expect(anchoCondicion(1440)).toBe(360);
    expect(anchoCondicion(300)).toBe(268);
  });
});
