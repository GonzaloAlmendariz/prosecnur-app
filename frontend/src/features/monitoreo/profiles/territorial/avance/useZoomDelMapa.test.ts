import { describe, expect, it } from "vitest";
import { ACERCAMIENTO_MAXIMO, acotar, zoomAlrededor } from "./useZoomDelMapa";

const BASE = { x: 0, y: 0, ancho: 1000, alto: 620 };

describe("zoom del mapa", () => {
  it("acerca alrededor del puntero: el punto bajo el mouse no se mueve", () => {
    const vista = zoomAlrededor(BASE, BASE, 2, 250, 155);
    expect(vista.ancho).toBe(500);
    expect((250 - vista.x) / vista.ancho).toBeCloseTo(0.25);
    expect((155 - vista.y) / vista.alto).toBeCloseTo(0.25);
  });

  it("no aleja más allá del lienzo ni acerca más del máximo", () => {
    expect(zoomAlrededor(BASE, BASE, 0.2, 500, 310)).toEqual(BASE);
    expect(zoomAlrededor(BASE, BASE, 1000, 500, 310).ancho).toBeCloseTo(BASE.ancho / ACERCAMIENTO_MAXIMO);
  });

  it("arrastrar no deja el mapa fuera del lienzo", () => {
    expect(acotar({ x: -300, y: 900, ancho: 500, alto: 310 }, BASE)).toEqual({ x: 0, y: 310, ancho: 500, alto: 310 });
  });
});
