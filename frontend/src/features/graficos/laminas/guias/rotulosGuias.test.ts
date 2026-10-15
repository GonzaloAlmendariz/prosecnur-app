// Rótulos de las guías sin choques (QA A3, defecto 1): umbral de tamaño, un rótulo por caja, dentro de la hoja y
// prioridad estable. El fixture «lámina de cuatro gráficos» reproduce la lámina 6 medida en vivo: 87 cajas, casi todas
// por debajo de 40 × 16 px a 1024.
import { describe, expect, it } from "vitest";
import type { PreviewForma, PreviewFormas, RolFormaPreview } from "../../../../api/graficos";
import { CAPAS_APAGADAS, construirGuias, type CapasGuias } from "./modeloGuias";
import {
  ALTO_ROTULO_PX,
  chocan,
  clasesDeRotulo,
  colocarRotulos,
  datoDeForma,
  dentroDeLaHoja,
  medirRotulo,
  UMBRAL_CAJA_PX,
  type HojaPx,
  type RotuloColocado,
} from "./rotulosGuias";

const forma = (p: Partial<PreviewForma>): PreviewForma => ({
  nombre: "", rol: "texto", x: 0, y: 0, w: 1, h: 1, ptMin: null, ptMax: null, lineas: null, recortado: null, grupo: null,
  ptEstandar: null, ...p,
});

const TODAS: CapasGuias = { cajas: true, espacios: true, tipografia: true, medidas: true, recetario: true };
const capas = (p: Partial<CapasGuias>): CapasGuias => ({ ...CAPAS_APAGADAS, ...p });

/** La hoja a 1024 con Estructura abierta (visor de ~700 px) y a 1440. */
const HOJA_1024: HojaPx = { ancho: 640, alto: 360 };
const HOJA_1440: HojaPx = { ancho: 1100, alto: 619 };

/** Cuatro gráficos en 2 × 2, cada uno con 20 piezas chicas (cifras, etiquetas, leyendas), título, antetítulo y base. */
function laminaCuatroGraficos(): PreviewFormas {
  const formas: PreviewForma[] = [
    forma({ nombre: "Titulo lamina", rol: "titulo", x: 0.495, y: 0.355, w: 12.3, h: 0.6, ptMin: 24, ptMax: 24, ptEstandar: 24 }),
    forma({ nombre: "Antetitulo", rol: "antetitulo", x: 0.495, y: 0.1, w: 4, h: 0.22, ptMin: 11, ptMax: 11 }),
    forma({ nombre: "Base lamina", rol: "base", x: 0.495, y: 7.05, w: 8, h: 0.25, ptMin: 9, ptMax: 9, recortado: true }),
  ];
  const roles: RolFormaPreview[] = ["cifra", "texto", "leyenda", "otro"];
  for (let g = 0; g < 4; g += 1) {
    const gx = 0.495 + (g % 2) * 6.3;
    const gy = 1.1 + Math.floor(g / 2) * 2.95;
    const nombre = `prosecnur:grafico:${g}`;
    formas.push(forma({ nombre, rol: "grafico", x: gx, y: gy, w: 6.1, h: 2.8 }));
    for (let k = 0; k < 20; k += 1) {
      formas.push(forma({
        nombre: `pieza ${g}-${k}`,
        rol: roles[k % roles.length],
        x: gx + 0.1 + (k % 5) * 1.15,
        y: gy + 0.15 + Math.floor(k / 5) * 0.62,
        w: 0.7 + (k % 3) * 0.05,
        h: 0.3,
        ptMin: 14, ptMax: 14, ptEstandar: k % 2 ? 14 : 12,
        grupo: nombre,
      }));
    }
  }
  return { disponible: true, porParte: { 1: formas }, ranuras: [{ rol: "grafico", x: 0.495, y: 1.1, w: 12.4, h: 5.75 }] };
}

const solapeVisible = (a: RotuloColocado, b: RotuloColocado) => {
  const ox = Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.alto, b.y + b.alto) - Math.max(a.y, b.y);
  return ox > 0 && oy > 0;
};

const choques = (rs: readonly RotuloColocado[]) => {
  let n = 0;
  for (let i = 0; i < rs.length; i += 1) for (let j = i + 1; j < rs.length; j += 1) if (solapeVisible(rs[i], rs[j])) n += 1;
  return n;
};

const fuera = (rs: readonly RotuloColocado[], h: HojaPx) =>
  rs.filter((r) => r.x < 0 || r.y < 0 || r.x + r.ancho > h.ancho + 1e-9 || r.y + r.alto > h.alto + 1e-9);

describe("lámina de cuatro gráficos con 87 cajas chicas", () => {
  const datos = laminaCuatroGraficos();
  const modelo = construirGuias(datos, 1, TODAS, []);

  it("el fixture es el de la medición: 87 cajas, la mayoría por debajo del umbral a 1024", () => {
    expect(modelo.elementos).toHaveLength(87);
    const chicas = modelo.elementos.filter((e) => (e.pos.width / 100) * HOJA_1024.ancho < UMBRAL_CAJA_PX.ancho || (e.pos.height / 100) * HOJA_1024.alto < UMBRAL_CAJA_PX.alto);
    expect(chicas.length).toBeGreaterThanOrEqual(80);
  });

  // Mutantes que mata: sin detección de colisión; sin umbral (las cajas chicas rotularían y se pisarían).
  for (const [nombre, hoja] of [["1024", HOJA_1024], ["1440", HOJA_1440]] as const) {
    it(`a ${nombre}: cero choques visibles y todos los rótulos dentro de la hoja, con las cinco capas`, () => {
      const rs = colocarRotulos(modelo, hoja);
      expect(rs.length).toBeGreaterThan(0);
      expect(choques(rs)).toBe(0);
      expect(fuera(rs, hoja)).toEqual([]);
    });
  }

  it("con sólo Cajas y Tipografía a 1024 tampoco se pisan los cuerpos sobre los segmentos", () => {
    const rs = colocarRotulos(construirGuias(datos, 1, capas({ cajas: true, tipografia: true }), []), HOJA_1024);
    expect(choques(rs)).toBe(0);
    expect(rs.every((r) => r.tipo === "caja")).toBe(true);
  });

  // Mutante que mata: dejar caer la regla de umbral (un rótulo por pieza de 0,7 × 0,3 in a 1024 = 34 × 14 px).
  it("una caja por debajo del umbral no rotula en línea, pero su dato sigue al pasar el mouse", () => {
    const rs = colocarRotulos(modelo, HOJA_1024);
    const piezas = modelo.elementos.filter((e) => e.nombre.startsWith("pieza"));
    expect(rs.filter((r) => piezas.some((p) => r.id === `c:${p.id}`))).toEqual([]);
    expect(datoDeForma(modelo, piezas[0].id)).toMatch(/pt, .* cm$/);
  });

  it("el título gana siempre su rótulo", () => {
    const titulo = modelo.elementos.find((e) => e.rol === "titulo");
    for (const hoja of [HOJA_1024, HOJA_1440]) {
      expect(colocarRotulos(modelo, hoja).some((r) => r.id === `c:${titulo?.id}`)).toBe(true);
    }
  });

  it("sin la hoja medida no se pinta ningún rótulo (no se coloca contra un tamaño inventado)", () => {
    expect(colocarRotulos(modelo, { ancho: 0, alto: 0 })).toEqual([]);
  });
});

describe("un rótulo por caja", () => {
  const datos: PreviewFormas = {
    disponible: true,
    porParte: { 1: [forma({ nombre: "Titulo", rol: "titulo", x: 0.5, y: 0.4, w: 12, h: 0.9, ptMin: 24, ptMax: 24, ptEstandar: 20 })] },
    ranuras: [],
  };

  // Mutante que mata: pintar un rótulo por capa (Tipografía y Medidas rotulando la misma caja por separado).
  it("Tipografía y Medidas sobre la misma caja dan un solo rótulo combinado", () => {
    const rs = colocarRotulos(construirGuias(datos, 1, capas({ tipografia: true, medidas: true }), []), HOJA_1440);
    expect(rs).toHaveLength(1);
    expect(rs[0].texto).toBe("24 pt, 30,48 × 2,29 cm");
    expect(clasesDeRotulo(rs[0]).split(" ")).toEqual(expect.arrayContaining(["is-caja", "is-pt", "is-fuera", "is-medida"]));
  });

  it("si el combinado no cabe a lo ancho de la caja, queda la parte más importante que sí cabe", () => {
    const angosta: PreviewFormas = { ...datos, porParte: { 1: [forma({ rol: "texto", x: 1, y: 1, w: 1.3, h: 0.6, ptMin: 12, ptMax: 12 })] } };
    const rs = colocarRotulos(construirGuias(angosta, 1, capas({ tipografia: true, medidas: true }), []), HOJA_1024);
    expect(rs.map((r) => r.texto)).toEqual(["12 pt"]);
  });
});

describe("dentro de la hoja", () => {
  // Mutante que mata: no recolocar (la cota del margen izquierdo, centrada cerca de x = 0, salía por el borde).
  it("un rótulo que asoma por un borde se desplaza hacia dentro", () => {
    expect(dentroDeLaHoja({ x: -13, y: -4, ancho: 50, alto: 16 }, HOJA_1024)).toEqual({ x: 0, y: 0, ancho: 50, alto: 16 });
    expect(dentroDeLaHoja({ x: 620, y: 352, ancho: 50, alto: 16 }, HOJA_1024)).toEqual({ x: 590, y: 344, ancho: 50, alto: 16 });
  });

  it("las cotas de margen y las medidas de cajas pegadas al borde quedan dentro", () => {
    const pegadas: PreviewFormas = {
      disponible: true,
      porParte: { 1: [
        forma({ rol: "texto", x: 0.02, y: 3, w: 1.2, h: 0.6, ptMin: 12, ptMax: 12 }),
        forma({ rol: "grafico", x: 12.1, y: 6.9, w: 1.23, h: 0.6 }),
      ] },
      ranuras: [],
    };
    const rs = colocarRotulos(construirGuias(pegadas, 1, capas({ espacios: true, medidas: true, tipografia: true }), []), HOJA_1024);
    expect(rs.some((r) => r.tipo === "cota")).toBe(true);
    expect(fuera(rs, HOJA_1024)).toEqual([]);
  });
});

describe("prioridad estable", () => {
  // Mutante que mata: invertir el orden (la cifra chica le quitaría el rótulo al título).
  it("ante un choque gana el rol de mayor prioridad, y luego la caja más grande", () => {
    const datos: PreviewFormas = {
      disponible: true,
      porParte: { 1: [
        forma({ nombre: "cifra", rol: "cifra", x: 0.5, y: 0.4, w: 3, h: 0.6, ptMin: 12, ptMax: 12 }),
        forma({ nombre: "titulo", rol: "titulo", x: 0.5, y: 0.4, w: 12, h: 0.9, ptMin: 24, ptMax: 24 }),
        forma({ nombre: "texto chico", rol: "texto", x: 6, y: 3, w: 2, h: 0.6, ptMin: 11, ptMax: 11 }),
        forma({ nombre: "texto grande", rol: "texto", x: 6, y: 3, w: 4, h: 1.2, ptMin: 11, ptMax: 11 }),
      ] },
      ranuras: [],
    };
    const m = construirGuias(datos, 1, capas({ tipografia: true }), []);
    const ids = colocarRotulos(m, HOJA_1440).map((r) => r.id);
    const id = (n: string) => `c:${m.elementos.find((e) => e.nombre === n)?.id}`;
    expect(ids).toContain(id("titulo"));
    expect(ids).not.toContain(id("cifra"));
    expect(ids).toContain(id("texto grande"));
    expect(ids).not.toContain(id("texto chico"));
    // Estable: mismo resultado con las formas en otro orden.
    const al_reves = construirGuias({ ...datos, porParte: { 1: [...datos.porParte[1]].reverse() } }, 1, capas({ tipografia: true }), []);
    expect(colocarRotulos(al_reves, HOJA_1440).map((r) => r.texto).sort()).toEqual(colocarRotulos(m, HOJA_1440).map((r) => r.texto).sort());
  });
});

describe("medida y choque", () => {
  it("la estimación es holgada: 10 px de cuerpo, alto de un rótulo", () => {
    const { ancho, alto } = medirRotulo("14 pt");
    expect(ancho).toBeGreaterThanOrEqual(5 * 6 + 8);
    expect(alto).toBe(ALTO_ROTULO_PX);
  });

  it("dos rótulos pegados también chocan; separados por más de la holgura, no", () => {
    expect(chocan({ x: 0, y: 0, ancho: 10, alto: 10 }, { x: 10, y: 0, ancho: 10, alto: 10 })).toBe(true);
    expect(chocan({ x: 0, y: 0, ancho: 10, alto: 10 }, { x: 12, y: 0, ancho: 10, alto: 10 })).toBe(false);
  });
});
