import { describe, expect, it } from "vitest";

import {
  acotarZoom,
  ajustarAContenido,
  asegurarVisible,
  cajaContenedora,
  mundoAPantalla,
  panear,
  pantallaAMundo,
  resolverGestoRueda,
  transformDeCamara,
  zoomEn,
  ZOOM_MAX,
  ZOOM_MIN,
  type Camara,
} from "./camara";

const IDENTIDAD: Camara = { x: 0, y: 0, zoom: 1 };

describe("acotarZoom", () => {
  it.each([
    [1, 1],
    [0.01, ZOOM_MIN],
    [99, ZOOM_MAX],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
  ])("%s => %s", (entrada, esperado) => {
    expect(acotarZoom(entrada)).toBe(esperado);
  });
});

describe("resolverGestoRueda", () => {
  it("pinch de trackpad llega con ctrlKey sintético y hace zoom", () => {
    const g = resolverGestoRueda({ deltaX: 0, deltaY: -20, deltaMode: 0, ctrlKey: true });
    expect(g.tipo).toBe("zoom");
  });

  it("Cmd + rueda fuerza zoom como escotilla explícita", () => {
    const g = resolverGestoRueda({ deltaX: 0, deltaY: 10, deltaMode: 0, ctrlKey: false, metaKey: true });
    expect(g.tipo).toBe("zoom");
  });

  it("dos dedos con componente horizontal es pan", () => {
    const g = resolverGestoRueda({ deltaX: 12, deltaY: 4, deltaMode: 0, ctrlKey: false });
    expect(g).toEqual({ tipo: "pan", dx: -12, dy: -4 });
  });

  it("la rueda física de un mouse hace zoom", () => {
    // `deltaMode` 1 = líneas: solo lo manda una rueda discreta.
    const g = resolverGestoRueda({ deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false });
    expect(g.tipo).toBe("zoom");
  });

  it("trackpad en vertical puro es pan, no zoom", () => {
    // Es el caso ambiguo: sin `deltaX` parece rueda, pero `deltaMode === 0`
    // solo lo produce un trackpad. Quien quiera zoom tiene pinch o Cmd.
    const g = resolverGestoRueda({ deltaX: 0, deltaY: 30, deltaMode: 0, ctrlKey: false });
    expect(g).toEqual({ tipo: "pan", dx: 0, dy: -30 });
  });

  it("el pan sigue al cursor, no lo invierte", () => {
    const g = resolverGestoRueda({ deltaX: 10, deltaY: 0, deltaMode: 0, ctrlKey: false });
    expect(g).toMatchObject({ dx: -10 });
  });
});

describe("zoomEn", () => {
  it("mantiene fijo el punto bajo el cursor", () => {
    const foco = { x: 300, y: 200 };
    const antes = pantallaAMundo(foco, IDENTIDAD);
    const camara = zoomEn(IDENTIDAD, 2, foco);
    const despues = pantallaAMundo(foco, camara);
    expect(despues.x).toBeCloseTo(antes.x, 6);
    expect(despues.y).toBeCloseTo(antes.y, 6);
  });

  it("no pasa de los límites", () => {
    expect(zoomEn(IDENTIDAD, 100, { x: 0, y: 0 }).zoom).toBe(ZOOM_MAX);
    expect(zoomEn(IDENTIDAD, 0.001, { x: 0, y: 0 }).zoom).toBe(ZOOM_MIN);
  });

  it("en el tope devuelve la MISMA cámara para no re-renderizar de gorra", () => {
    const tope: Camara = { x: 10, y: 10, zoom: ZOOM_MAX };
    expect(zoomEn(tope, 2, { x: 0, y: 0 })).toBe(tope);
  });
});

describe("pantallaAMundo / mundoAPantalla", () => {
  it("son inversas", () => {
    const camara: Camara = { x: -120, y: 45, zoom: 1.75 };
    const punto = { x: 321, y: 654 };
    const ida = pantallaAMundo(punto, camara);
    const vuelta = mundoAPantalla(ida, camara);
    expect(vuelta.x).toBeCloseTo(punto.x, 6);
    expect(vuelta.y).toBeCloseTo(punto.y, 6);
  });

  it("con la cámara en identidad son la identidad", () => {
    expect(pantallaAMundo({ x: 5, y: 7 }, IDENTIDAD)).toEqual({ x: 5, y: 7 });
  });
});

describe("panear", () => {
  it("suma el desplazamiento sin tocar el zoom", () => {
    expect(panear({ x: 10, y: 20, zoom: 2 }, 5, -5)).toEqual({ x: 15, y: 15, zoom: 2 });
  });
});

describe("cajaContenedora", () => {
  it("envuelve todas las cajas", () => {
    expect(
      cajaContenedora([
        { x: 0, y: 0, w: 100, h: 50 },
        { x: 200, y: 80, w: 40, h: 40 },
      ]),
    ).toEqual({ x: 0, y: 0, w: 240, h: 120 });
  });

  it("sin cajas devuelve null en vez de una caja en cero", () => {
    expect(cajaContenedora([])).toBeNull();
  });
});

describe("ajustarAContenido", () => {
  it("centra el contenido en el viewport", () => {
    const camara = ajustarAContenido({ x: 0, y: 0, w: 400, h: 200 }, { w: 800, h: 600 });
    const centroMundo = mundoAPantalla({ x: 200, y: 100 }, camara);
    expect(centroMundo.x).toBeCloseTo(400, 6);
    expect(centroMundo.y).toBeCloseTo(300, 6);
  });

  it("no amplía más allá del 100%", () => {
    // Encuadrar un solo nodo chico no debería dejarlo gigante.
    const camara = ajustarAContenido({ x: 0, y: 0, w: 40, h: 30 }, { w: 1200, h: 800 });
    expect(camara.zoom).toBe(1);
  });

  it("reduce cuando el contenido no cabe", () => {
    const camara = ajustarAContenido({ x: 0, y: 0, w: 4000, h: 3000 }, { w: 800, h: 600 });
    expect(camara.zoom).toBeLessThan(1);
    expect(camara.zoom).toBeGreaterThanOrEqual(ZOOM_MIN);
  });

  it("sin contenido vuelve al origen en vez de a una cámara inválida", () => {
    expect(ajustarAContenido(null, { w: 800, h: 600 })).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(ajustarAContenido({ x: 0, y: 0, w: 0, h: 0 }, { w: 800, h: 600 })).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe("asegurarVisible", () => {
  const viewport = { w: 800, h: 600 };

  it("no mueve nada si la caja ya está a la vista", () => {
    const camara: Camara = { x: 0, y: 0, zoom: 1 };
    expect(asegurarVisible(camara, { x: 100, y: 100, w: 200, h: 100 }, viewport)).toBe(camara);
  });

  it("acerca lo mínimo cuando la caja está a la derecha", () => {
    const camara: Camara = { x: 0, y: 0, zoom: 1 };
    const out = asegurarVisible(camara, { x: 900, y: 100, w: 100, h: 50 }, viewport);
    const p1 = mundoAPantalla({ x: 1000, y: 150 }, out);
    expect(p1.x).toBeLessThanOrEqual(viewport.w);
    expect(out.zoom).toBe(1);
  });

  it("acerca cuando la caja está arriba fuera de vista", () => {
    const camara: Camara = { x: 0, y: 0, zoom: 1 };
    const out = asegurarVisible(camara, { x: 100, y: -400, w: 100, h: 50 }, viewport);
    expect(out.y).toBeGreaterThan(0);
  });
});

describe("transformDeCamara", () => {
  it("emite un transform CSS listo para el DOM", () => {
    expect(transformDeCamara({ x: 10, y: -20, zoom: 1.5 })).toBe("translate(10px, -20px) scale(1.5)");
  });
});
