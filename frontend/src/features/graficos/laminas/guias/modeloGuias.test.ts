import { describe, expect, it } from "vitest";
import { normalizePreviewFormas, type PreviewForma, type PreviewFormas } from "../../../../api/graficos";
import {
  aCm,
  aPorcentaje,
  CAPAS_APAGADAS,
  calcularEspacios,
  construirGuias,
  filtrarPorRol,
  formaBajoPunto,
  formatoCm,
  fueraDeRecetario,
  LIENZO_ESTANDAR,
  rolesPresentes,
  rotuloPt,
  type CapasGuias,
} from "./modeloGuias";

const forma = (p: Partial<PreviewForma>): PreviewForma => ({
  nombre: "", rol: "texto", x: 0, y: 0, w: 1, h: 1, ptMin: null, ptMax: null, lineas: null, recortado: null, grupo: null,
  ptEstandar: null, ...p,
});

const capas = (p: Partial<CapasGuias>): CapasGuias => ({ ...CAPAS_APAGADAS, ...p });

/** Lámina tipo «un gráfico»: título arriba, gráfico al medio, base abajo (medidas del estándar). */
const LAMINA: PreviewFormas = {
  disponible: true,
  porParte: {
    1: [
      forma({ nombre: "Titulo lamina", rol: "titulo", x: 0.495, y: 0.355, w: 12.523, h: 0.9, ptMin: 24, ptMax: 24, ptEstandar: 24 }),
      forma({ nombre: "prosecnur:grafico:barras", rol: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 4.6 }),
      forma({ nombre: "cifra", rol: "cifra", x: 1, y: 2, w: 0.5, h: 0.3, ptMin: 12, ptMax: 12, ptEstandar: 14, grupo: "prosecnur:grafico:barras" }),
      forma({ nombre: "Base lamina", rol: "base", x: 0.495, y: 6.88, w: 6, h: 0.3, ptMin: 10, ptMax: 10, recortado: true }),
    ],
  },
  ranuras: [{ rol: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 4.6 }],
};

describe("conversión de pulgadas a % del lienzo", () => {
  // Mutante que mata: dividir x por el alto (o y por el ancho) — 0.495/7.5 da 6,6 % en vez de 3,71 %.
  it("x y ancho van contra el ancho de 13,333 in; y y alto, contra los 7,5 in", () => {
    const p = aPorcentaje({ x: 0.495, y: 1.65, w: 12.523, h: 4.6 });
    expect(p.left).toBeCloseTo(3.7126, 3);
    expect(p.top).toBeCloseTo(22, 3);
    expect(p.width).toBeCloseTo(93.925, 2);
    expect(p.height).toBeCloseTo(61.333, 2);
  });

  // Mutante que mata: no recortar al borde (una caja que sale de la hoja dibujaría fuera del lienzo).
  it("lo que sale de la hoja se recorta al borde", () => {
    const p = aPorcentaje({ x: -1, y: 7, w: 2, h: 1 });
    expect(p.left).toBe(0);
    expect(p.width).toBeCloseTo((1 / LIENZO_ESTANDAR.ancho) * 100, 5);
    expect(p.top + p.height).toBe(100);
  });

  it("escala con el lienzo que se le pase", () => {
    expect(aPorcentaje({ x: 5, y: 0, w: 5, h: 10 }, { ancho: 10, alto: 10 })).toEqual({ left: 50, top: 0, width: 50, height: 100 });
  });

  // Mutante que mata: 2.5 en vez de 2.54, o formatear con punto.
  it("los cm son pulgadas × 2,54 con coma decimal", () => {
    expect(aCm(1)).toBe(2.54);
    expect(formatoCm(0.46)).toBe("1,17 cm");
  });
});

describe("espacios entre cajas y a los bordes", () => {
  const titulo = { x: 0.495, y: 0.355, w: 12.523, h: 0.9 };
  const grafico = { x: 0.495, y: 1.65, w: 12.523, h: 4.6 };

  // Mutante que mata: medir desde el y (no desde el borde inferior) de la caja de arriba → 1,295 en vez de 0,395.
  it("la separación vertical es del borde inferior de una al superior de la siguiente", () => {
    const sep = calcularEspacios([titulo, grafico]).filter((e) => e.tipo === "separacion");
    expect(sep).toHaveLength(1);
    expect(sep[0].eje).toBe("v");
    expect(sep[0].valor).toBeCloseTo(0.395, 6);
    expect(formatoCm(sep[0].valor)).toBe("1,00 cm");
  });

  // Mutante que mata: margen derecho calculado como el x de la caja (sin restarlo del ancho de la lámina).
  it("los márgenes miden del bloque de contenido a cada borde", () => {
    const m = Object.fromEntries(calcularEspacios([titulo, grafico]).filter((e) => e.tipo === "margen").map((e) => [e.id, e.valor]));
    expect(m["m:izquierdo"]).toBeCloseTo(0.495, 6);
    expect(m["m:derecho"]).toBeCloseTo(13.333 - 13.018, 6);
    expect(m["m:superior"]).toBeCloseTo(0.355, 6);
    expect(m["m:inferior"]).toBeCloseTo(7.5 - 6.25, 6);
  });

  // Mutante que mata: no exigir solape de columna (una caja en otra columna no es «la de abajo»).
  it("sólo mide entre cajas que comparten columna o fila, y sólo con la más cercana", () => {
    const a = { x: 0, y: 0, w: 4, h: 1 };
    const lejos = { x: 0, y: 4, w: 4, h: 1 };
    const cerca = { x: 1, y: 2, w: 2, h: 1 };
    const otraColumna = { x: 8, y: 1.2, w: 2, h: 1 };
    const sep = calcularEspacios([a, lejos, cerca, otraColumna]).filter((e) => e.tipo === "separacion" && e.eje === "v");
    const desdeA = sep.find((e) => e.desde.y === 1);
    expect(desdeA?.valor).toBeCloseTo(1, 6);
    expect(sep.some((e) => Math.abs(e.valor - 0.2) < 1e-6)).toBe(false);
  });

  it("dos columnas lado a lado dan una separación horizontal", () => {
    const sep = calcularEspacios([{ x: 0.5, y: 1.65, w: 6, h: 4 }, { x: 7, y: 1.65, w: 5.8, h: 4 }]).filter((e) => e.tipo === "separacion");
    expect(sep).toEqual([expect.objectContaining({ eje: "h", valor: 0.5 })]);
  });

  // Mutante que mata: no excluir fondos (un rectángulo de lámina entera deja todos los márgenes en cero).
  it("un fondo de lámina entera no cuenta como sección", () => {
    const fondo = { x: 0, y: 0, w: 13.333, h: 7.5 };
    const m = calcularEspacios([fondo, titulo]).filter((e) => e.tipo === "margen");
    expect(m.find((e) => e.id === "m:izquierdo")?.valor).toBeCloseTo(0.495, 6);
  });

  it("cajas que se tocan o se superponen no tienen separación", () => {
    expect(calcularEspacios([{ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 1.5, w: 2, h: 2 }]).filter((e) => e.tipo === "separacion")).toEqual([]);
  });
});

describe("tipografía contra el recetario", () => {
  // Mutante que mata: marcar en rojo sin referencia (comparar contra un cuerpo inventado).
  it("sin cuerpo del recetario no hay marca roja", () => {
    expect(fueraDeRecetario({ ptMin: 9, ptMax: 30, ptEstandar: null })).toBe(false);
  });

  // Mutante que mata: comparar sólo el mínimo (un título con un tramo de 28 pt pasaría).
  it("se marca si el menor o el mayor se aparta más de medio punto", () => {
    expect(fueraDeRecetario({ ptMin: 24, ptMax: 24, ptEstandar: 24 })).toBe(false);
    expect(fueraDeRecetario({ ptMin: 24, ptMax: 24.4, ptEstandar: 24 })).toBe(false);
    expect(fueraDeRecetario({ ptMin: 24, ptMax: 28, ptEstandar: 24 })).toBe(true);
    expect(fueraDeRecetario({ ptMin: 12, ptMax: 12, ptEstandar: 14 })).toBe(true);
  });

  it("el rótulo dice el cuerpo, o el rango si el texto mezcla tamaños", () => {
    expect(rotuloPt({ ptMin: 24, ptMax: 24 })).toBe("24 pt");
    expect(rotuloPt({ ptMin: 10.5, ptMax: 10.5 })).toBe("10,5 pt");
    expect(rotuloPt({ ptMin: 12, ptMax: 14 })).toBe("12–14 pt");
    expect(rotuloPt({ ptMin: null, ptMax: null })).toBeNull();
  });
});

describe("filtro por rol", () => {
  // Mutante que mata: invertir el filtro (dejar sólo los ocultos).
  it("deja fuera los roles ocultos y conserva el resto", () => {
    const fs = LAMINA.porParte[1];
    expect(filtrarPorRol(fs, ["cifra", "base"]).map((f) => f.rol)).toEqual(["titulo", "grafico"]);
    expect(filtrarPorRol(fs, [])).toHaveLength(4);
  });

  it("el filtro también alcanza a las ranuras del recetario", () => {
    const m = construirGuias(LAMINA, 1, capas({ recetario: true }), ["grafico"]);
    expect(m.recetario).toEqual([]);
    expect(construirGuias(LAMINA, 1, capas({ recetario: true }), []).recetario).toHaveLength(1);
  });

  it("los roles presentes salen en orden de lectura con su cuenta (formas y ranuras)", () => {
    expect(rolesPresentes(LAMINA.porParte[1], LAMINA.ranuras)).toEqual([
      { rol: "titulo", n: 1 }, { rol: "grafico", n: 2 }, { rol: "cifra", n: 1 }, { rol: "base", n: 1 },
    ]);
  });
});

describe("combinación de capas", () => {
  // Mutante que mata: una capa que se dibuja apagada (o que apaga a otra).
  it("cada capa aporta sólo lo suyo y se combinan sin pisarse", () => {
    const nada = construirGuias(LAMINA, 1, CAPAS_APAGADAS, []);
    expect(nada.activa).toBe(false);
    expect([nada.cajas, nada.tipografia, nada.medidas, nada.espacios, nada.recetario].every((l) => l.length === 0)).toBe(true);

    const dos = construirGuias(LAMINA, 1, capas({ tipografia: true, medidas: true }), []);
    expect(dos.activa).toBe(true);
    expect(dos.cajas).toEqual([]);
    expect(dos.espacios).toEqual([]);
    expect(dos.tipografia.map((e) => e.pt)).toEqual(["24 pt", "12 pt", "10 pt"]);
    expect(dos.medidas).toHaveLength(4);

    const todas = construirGuias(LAMINA, 1, capas({ cajas: true, espacios: true, tipografia: true, medidas: true, recetario: true }), []);
    expect(todas.cajas).toHaveLength(4);
    expect(todas.recetario).toHaveLength(1);
    expect(todas.espacios.length).toBeGreaterThan(0);
  });

  // Mutante que mata: calcular espacios con las formas anidadas (la cifra dentro del gráfico partiría la separación).
  it("los espacios miden sólo secciones de primer nivel", () => {
    const m = construirGuias(LAMINA, 1, capas({ espacios: true }), []);
    const sep = m.espacios.filter((e) => e.tipo === "separacion").map((e) => Number(e.valor.toFixed(3)));
    expect(sep).toEqual([0.395, 0.63]);
    expect(m.espacios.every((e) => e.rotulo.endsWith(" cm"))).toBe(true);
  });

  it("el resumen cuenta textos fuera del recetario y recortados, y avisa cuando no hay referencia", () => {
    const m = construirGuias(LAMINA, 1, capas({ tipografia: true }), []);
    expect(m.resumen).toEqual({ elementos: 4, textos: 3, fueraDeRecetario: 1, recortados: 1, sinReferencia: false });
    const sinRef = construirGuias({ ...LAMINA, porParte: { 1: [forma({ ptMin: 12, ptMax: 12 })] } }, 1, capas({ tipografia: true }), []);
    expect(sinRef.resumen.sinReferencia).toBe(true);
    expect(sinRef.tipografia[0].ptFuera).toBe(false);
  });

  it("sin formas en la respuesta no hay nada que dibujar aunque haya capas encendidas", () => {
    expect(construirGuias(null, 1, capas({ cajas: true }), []).activa).toBe(false);
    expect(construirGuias({ disponible: false, porParte: {}, ranuras: [] }, 1, capas({ cajas: true }), []).activa).toBe(false);
  });

  it("las formas sin caja medida no se dibujan (null no es cero)", () => {
    const m = construirGuias({ disponible: true, porParte: { 1: [forma({ x: null }), forma({ w: 0 })] }, ranuras: [] }, 1, capas({ cajas: true }), []);
    expect(m.cajas).toEqual([]);
  });

  it("la parte que se mira es la que se dibuja", () => {
    const datos: PreviewFormas = { disponible: true, porParte: { 1: [forma({ nombre: "a" })], 2: [forma({ nombre: "b" }), forma({ nombre: "c" })] }, ranuras: [] };
    expect(construirGuias(datos, 2, capas({ cajas: true }), []).cajas.map((e) => e.nombre)).toEqual(["b", "c"]);
  });
});

describe("nombre al pasar el mouse", () => {
  // Mutante que mata: devolver la primera caja que contiene el punto (el grupo taparía al texto de dentro).
  it("gana la caja más chica que contiene el punto", () => {
    const m = construirGuias(LAMINA, 1, capas({ cajas: true }), []);
    expect(formaBajoPunto(m.cajas, 1.2, 2.1)).toBe(m.cajas.find((e) => e.rol === "cifra")?.id);
    expect(formaBajoPunto(m.cajas, 6, 4)).toBe(m.cajas.find((e) => e.rol === "grafico")?.id);
    expect(formaBajoPunto(m.cajas, 13.2, 7.4)).toBeNull();
  });
});

describe("normalizePreviewFormas (payload de R, auto_unbox)", () => {
  it("lee formas por parte, null como null, y ranuras del estándar", () => {
    const n = normalizePreviewFormas({
      partes: { n: 2, partes: [
        { indice: 1, formas: [{ nombre: "Titulo lamina", rol: "titulo", x: 0.495, y: 0.355, w: 12.523, h: 0.9, pt_min: 24, pt_max: 24, lineas: 1, recortado: false, grupo: null }] },
        { indice: 2, formas: { nombre: "suelta", rol: "inventado", x: 1, y: 1, w: 1, h: 1, pt_min: null, pt_max: null, lineas: null, recortado: null, grupo: "g" } },
      ] },
      ranuras_estandar: [{ rol: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 4.6 }, { rol: "x", x: null, y: 0, w: 1, h: 1 }],
    });
    expect(n.disponible).toBe(true);
    expect(n.porParte[1][0]).toMatchObject({ rol: "titulo", ptMin: 24, recortado: false, grupo: null, ptEstandar: null });
    expect(n.porParte[2]).toEqual([expect.objectContaining({ nombre: "suelta", rol: "otro", ptMin: null, recortado: null, grupo: "g" })]);
    expect(n.ranuras).toEqual([{ rol: "grafico", x: 0.495, y: 1.65, w: 12.523, h: 4.6 }]);
  });

  it("una respuesta sin `preview_formas` no está disponible (desconexión, no lámina vacía)", () => {
    expect(normalizePreviewFormas({ partes: { n: 1, partes: [{ indice: 1 }] } })).toEqual({ disponible: false, porParte: {}, ranuras: [] });
    expect(normalizePreviewFormas(null).disponible).toBe(false);
  });

  it("formas vacías de R (`{}`) son una parte sin elementos", () => {
    const n = normalizePreviewFormas({ partes: { partes: [{ indice: 1, formas: {} }] }, ranuras_estandar: {} });
    expect(n).toEqual({ disponible: true, porParte: { 1: [] }, ranuras: [] });
  });

  it("lee `pt_estandar` cuando el backend lo envíe", () => {
    const n = normalizePreviewFormas({ partes: { partes: [{ indice: 1, formas: [{ rol: "titulo", x: 0, y: 0, w: 1, h: 1, pt_min: 20, pt_max: 20, pt_estandar: 24 }] }] } });
    expect(fueraDeRecetario(n.porParte[1][0])).toBe(true);
  });
});
