import { describe, expect, test } from "vitest";
import { normalizarGeometriaHojasRuta } from "../../../../api/hojasRuta";
import { aMundo, aPantalla, cajaVisible, debeVolar, encuadre, ESCALA_ENCUADRE_MAX, ESCALA_MAX, escalaGrafica, interpolar, zoomRueda, arrastre } from "./camara";
import { cajaDe, centroDe, nivelDensidad, piezasDeGeometria, unirCajas, visibles } from "./piezas";

const T = { w: 800, h: 600 };

describe("cámara del lienzo", () => {
  test("el primer encuadre salta: volar desde el origen pinta el mapa en blanco o a medio camino", () => {
    const base = { animar: true, reducido: false, ancho: 800 };
    expect(debeVolar({ ...base, encuadrado: false })).toBe(false);
    expect(debeVolar({ ...base, encuadrado: true })).toBe(true);
    expect(debeVolar({ ...base, encuadrado: true, reducido: true })).toBe(false);
    expect(debeVolar({ ...base, encuadrado: true, ancho: 0 })).toBe(false);
    expect(debeVolar({ ...base, encuadrado: true, animar: false })).toBe(false);
  });

  test("pantalla y mundo son inversas", () => {
    const c = { x: 1200, y: -8600, s: 0.4 };
    const [px, py] = aPantalla(c, T, 1500, -8500);
    expect(aMundo(c, T, px, py)).toEqual([1500, -8500]);
    expect(aPantalla(c, T, c.x, c.y)).toEqual([400, 300]);
  });

  test("el encuadre centra la caja, deja margen y no acerca más del tope", () => {
    const c = encuadre([0, 0, 1000, 500], T, 0.1);
    expect([c.x, c.y]).toEqual([500, 250]);
    const vista = cajaVisible(c, T);
    expect(vista[0]).toBeLessThan(0);
    expect(vista[2]).toBeGreaterThan(1000);
    expect(encuadre([0, 0, 2, 2], T).s).toBe(ESCALA_ENCUADRE_MAX);
  });

  test("con algo tapando abajo, encuadra la caja en la franja visible de arriba", () => {
    const c = encuadre([0, 0, 1000, 500], T, 0.1, 0.5);
    const [, yArriba] = aPantalla(c, T, 0, 0);
    const [, yAbajo] = aPantalla(c, T, 0, 500);
    expect(yAbajo).toBeLessThanOrEqual(T.h * 0.5 + 1e-6);
    expect((yArriba + yAbajo) / 2).toBeCloseTo(T.h * 0.25, 6);
  });

  test("la rueda deja fijo el punto bajo el cursor y respeta los límites", () => {
    const c = { x: 0, y: 0, s: 0.1 };
    const antes = aMundo(c, T, 650, 120);
    const z = zoomRueda(c, T, 650, 120, -100, 0, false);
    expect(z.s).toBeGreaterThan(c.s);
    const despues = aMundo(z, T, 650, 120);
    expect(despues[0]).toBeCloseTo(antes[0], 6);
    expect(despues[1]).toBeCloseTo(antes[1], 6);
    // el pellizco acerca más que la rueda con el mismo delta, y un delta enorme se acota
    expect(zoomRueda(c, T, 400, 300, -50, 0, true).s).toBeGreaterThan(zoomRueda(c, T, 400, 300, -50, 0, false).s);
    expect(zoomRueda(c, T, 400, 300, -5000, 0, false).s).toBe(zoomRueda(c, T, 400, 300, -120, 0, false).s);
    expect(zoomRueda({ x: 0, y: 0, s: ESCALA_MAX }, T, 400, 300, -120, 0, true).s).toBe(ESCALA_MAX);
  });

  test("arrastrar mueve la cámara al revés que el puntero", () => {
    expect(arrastre({ x: 100, y: 100, s: 0.5 }, 50, -20)).toEqual({ x: 0, y: 140, s: 0.5 });
  });

  test("el vuelo llega exacto y avanza la escala en logaritmo", () => {
    const desde = { x: 0, y: 0, s: 0.01 }, hasta = { x: 1000, y: 500, s: 1 };
    expect(interpolar(desde, hasta, 0)).toEqual(desde);
    expect(interpolar(desde, hasta, 1)).toEqual(hasta);
    expect(interpolar(desde, hasta, 0.5).s).toBeCloseTo(0.1, 6);
  });

  test("la escala gráfica elige un largo redondo de al menos 70 px", () => {
    expect(escalaGrafica(1)).toMatchObject({ metros: 100, rotulo: "100 m" });
    expect(escalaGrafica(0.02)).toMatchObject({ metros: 5000, rotulo: "5 km" });
  });
});

describe("piezas del lienzo", () => {
  const cruda = {
    ok: true,
    version: "hojas_ruta_geometria/v1",
    ubigeo: "150103",
    nombre: "ATE",
    bbox: [0, 0, 300, 300],
    manz: [
      ["150103001000010", 34, "00100", 5, [[0, 0, 100, 0, 100, 100, 0, 100, 0, 0]]],
      ["150103001000020", 0, "00100", 9, [[200, 200, 300, 200, 300, 300, 200, 200]]],
      ["sin-anillo", 3, "00100", 1, [[0, 0, 1, 1]]],
      "basura",
    ],
    calles: [[2, "AV. NICOLAS AYLLON", [[0, 50, 300, 50]]], [1, "", [[5]]]],
    zonas: [["00100", [[0, 0, 300, 0, 300, 300, 0, 0]]]],
  };

  test("el normalizador descarta lo que no se puede dibujar y acota el NSE", () => {
    const g = normalizarGeometriaHojasRuta(cruda);
    expect(g.ok).toBe(true);
    expect(g.manzanas.map((m) => m.id)).toEqual(["150103001000010", "150103001000020"]);
    expect(g.manzanas[1].nse).toBe(0);
    expect(g.vias).toHaveLength(1);
    expect(g.vias[0]).toMatchObject({ rango: 2, nombre: "AV. NICOLAS AYLLON" });
    expect(g.zonas[0].codigo).toBe("00100");
    expect(normalizarGeometriaHojasRuta(null)).toMatchObject({ ok: false, manzanas: [], bbox: [0, 0, 0, 0] });
  });

  test("cada pieza trae su caja y su centro, y el recorte deja sólo lo visible", () => {
    const d = piezasDeGeometria(normalizarGeometriaHojasRuta(cruda));
    expect(d.manzanas[0].caja).toEqual([0, 0, 100, 100]);
    expect(d.manzanas[0].centro[0]).toBeCloseTo(40, 6);
    expect(visibles(d.manzanas, [150, 150, 400, 400]).map((m) => m.id)).toEqual(["150103001000020"]);
    expect(visibles(d.vias, [0, 40, 10, 60])).toHaveLength(1);
    expect(unirCajas([[0, 0, 1, 1], [5, -2, 6, 3]])).toEqual([0, -2, 6, 3]);
    expect(unirCajas([])).toBeNull();
    expect(cajaDe([[3, 4, -1, 9]])).toEqual([-1, 4, 3, 9]);
    expect(centroDe([])).toEqual([0, 0]);
  });

  test("la densidad sube un nivel cada vez que se duplican las viviendas", () => {
    expect([0, 3, 6, 12, 24, 400, 5000].map(nivelDensidad)).toEqual([0, 1, 1, 2, 3, 6, 6]);
  });
});
