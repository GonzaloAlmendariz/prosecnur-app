import { describe, expect, it } from "vitest";

import {
  alternarSeleccion,
  aplicarArrastre,
  esArrastre,
  intersecta,
  normalizarRect,
  ordenDeLectura,
  seleccionEnRectangulo,
  siguienteEnDireccion,
  siguienteEnOrden,
  type Caja,
} from "./seleccion";

const CAJAS = new Map<string, Caja>([
  ["a", { x: 0, y: 0, w: 100, h: 60 }],
  ["b", { x: 200, y: 0, w: 100, h: 60 }],
  ["c", { x: 0, y: 200, w: 100, h: 60 }],
  ["d", { x: 200, y: 200, w: 100, h: 60 }],
]);

describe("esArrastre", () => {
  it("el temblor de la mano no cuenta como arrastre", () => {
    // Sin umbral, cada clic sería un micro-drag y la selección nunca ocurriría.
    expect(esArrastre(1, 1)).toBe(false);
    expect(esArrastre(3, 2)).toBe(true);
  });
});

describe("alternarSeleccion", () => {
  it("sin modificador reemplaza", () => {
    expect([...alternarSeleccion(new Set(["a"]), "b", false)]).toEqual(["b"]);
  });

  it("con modificador agrega y quita", () => {
    expect([...alternarSeleccion(new Set(["a"]), "b", true)].sort()).toEqual(["a", "b"]);
    expect([...alternarSeleccion(new Set(["a", "b"]), "a", true)]).toEqual(["b"]);
  });

  it("clic sobre uno de varios ya elegidos conserva la selección", () => {
    // Es lo que permite arrastrar el grupo entero: sin esto, agarrar uno de
    // tres deshace la selección y solo se mueve ese.
    expect([...alternarSeleccion(new Set(["a", "b", "c"]), "b", false)].sort()).toEqual(["a", "b", "c"]);
  });

  it("clic sobre el único seleccionado lo deja igual", () => {
    expect([...alternarSeleccion(new Set(["a"]), "a", false)]).toEqual(["a"]);
  });
});

describe("seleccionEnRectangulo", () => {
  it("basta rozar un nodo para seleccionarlo", () => {
    // Contención exigiría envolver el nodo entero, que en un lienzo denso es
    // imposible sin tocar los vecinos.
    const rect = normalizarRect({ x: 90, y: 50 }, { x: 110, y: 70 });
    expect([...seleccionEnRectangulo(CAJAS, rect)]).toEqual(["a"]);
  });

  it("toma todos los que cruza", () => {
    const rect = normalizarRect({ x: -10, y: -10 }, { x: 400, y: 100 });
    expect([...seleccionEnRectangulo(CAJAS, rect)].sort()).toEqual(["a", "b"]);
  });

  it("con selección previa suma en vez de reemplazar", () => {
    const rect = normalizarRect({ x: 190, y: 190 }, { x: 320, y: 280 });
    expect([...seleccionEnRectangulo(CAJAS, rect, new Set(["a"]))].sort()).toEqual(["a", "d"]);
  });

  it("un marco en el vacío no selecciona nada", () => {
    const rect = normalizarRect({ x: 500, y: 500 }, { x: 600, y: 600 });
    expect([...seleccionEnRectangulo(CAJAS, rect)]).toEqual([]);
  });
});

describe("normalizarRect", () => {
  it("funciona arrastrando en cualquier dirección", () => {
    expect(normalizarRect({ x: 100, y: 100 }, { x: 0, y: 0 }))
      .toEqual({ x0: 0, y0: 0, x1: 100, y1: 100 });
  });
});

describe("intersecta", () => {
  it("bordes que apenas se tocan no cuentan", () => {
    expect(intersecta({ x: 0, y: 0, w: 10, h: 10 }, { x0: 10, y0: 0, x1: 20, y1: 10 })).toBe(false);
  });
});

describe("aplicarArrastre", () => {
  it("parte de las posiciones iniciales, no de las actuales", () => {
    // Acumular el delta de cada frame deriva, y un grupo movido lejos termina
    // desalineado respecto del cursor.
    const iniciales = new Map([["a", { x: 10, y: 20 }], ["b", { x: 50, y: 60 }]]);
    const out = aplicarArrastre(iniciales, 5, -5);
    expect(out.get("a")).toEqual({ x: 15, y: 15 });
    expect(out.get("b")).toEqual({ x: 55, y: 55 });
  });

  it("aplica el ajuste a grilla si se le pasa", () => {
    const out = aplicarArrastre(new Map([["a", { x: 0, y: 0 }]]), 7, 7, (v) => Math.round(v / 16) * 16);
    expect(out.get("a")).toEqual({ x: 0, y: 0 });
  });

  it("preserva los offsets relativos del grupo", () => {
    const iniciales = new Map([["a", { x: 0, y: 0 }], ["b", { x: 100, y: 40 }]]);
    const out = aplicarArrastre(iniciales, 33, 17);
    expect(out.get("b")!.x - out.get("a")!.x).toBe(100);
    expect(out.get("b")!.y - out.get("a")!.y).toBe(40);
  });
});

describe("siguienteEnDireccion", () => {
  it.each([
    ["a", "derecha", "b"],
    ["a", "abajo", "c"],
    ["b", "izquierda", "a"],
    ["d", "arriba", "b"],
  ])("desde %s hacia %s => %s", (desde, dir, esperado) => {
    expect(siguienteEnDireccion(CAJAS, desde, dir as never)).toBe(esperado);
  });

  it("prefiere el vecino alineado antes que uno lejano en diagonal", () => {
    const cajas = new Map<string, Caja>([
      ["origen", { x: 0, y: 0, w: 50, h: 50 }],
      ["alineado", { x: 200, y: 0, w: 50, h: 50 }],
      ["diagonal", { x: 100, y: 400, w: 50, h: 50 }],
    ]);
    expect(siguienteEnDireccion(cajas, "origen", "derecha")).toBe("alineado");
  });

  it("sin nada en esa dirección devuelve null", () => {
    expect(siguienteEnDireccion(CAJAS, "b", "derecha")).toBeNull();
  });

  it("desde un id inexistente devuelve null en vez de fallar", () => {
    expect(siguienteEnDireccion(CAJAS, "fantasma", "derecha")).toBeNull();
  });
});

describe("ordenDeLectura", () => {
  it("va de arriba a abajo y de izquierda a derecha", () => {
    expect(ordenDeLectura(CAJAS)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("siguienteEnOrden", () => {
  const orden = ["a", "b", "c"];

  it("avanza y retrocede", () => {
    expect(siguienteEnOrden(orden, "a", 1)).toBe("b");
    expect(siguienteEnOrden(orden, "b", -1)).toBe("a");
  });

  it("envuelve en los extremos para no dejar al usuario sin salida", () => {
    expect(siguienteEnOrden(orden, "c", 1)).toBe("a");
    expect(siguienteEnOrden(orden, "a", -1)).toBe("c");
  });

  it("sin foco previo entra por el primero o por el último", () => {
    expect(siguienteEnOrden(orden, null, 1)).toBe("a");
    expect(siguienteEnOrden(orden, null, -1)).toBe("c");
  });

  it("con la lista vacía devuelve null", () => {
    expect(siguienteEnOrden([], "a", 1)).toBeNull();
  });
});
