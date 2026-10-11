// Guías del visor por capas (plan F6 §8, K11). Lógica pura: de las formas que la vista previa leyó del PPTX (en
// pulgadas) a lo que dibuja la capa sobre la lámina (en % del lienzo). Las guías viven sólo en el visor: nunca entran al
// entregable (D17) ni a la config del proyecto.
//
// Cinco capas activables y combinables, más un filtro por rol:
//   cajas      — el contorno de cada elemento; su nombre al pasar el mouse.
//   espacios   — separaciones entre las secciones de primer nivel y márgenes del contenido a los bordes, en cm.
//   tipografia — el cuerpo en pt de cada texto; en rojo si se aparta del recetario.
//   medidas    — ancho × alto de cada caja, en cm.
//   recetario  — las ranuras del estándar del tipo, superpuestas.

import type { PreviewForma, PreviewFormas, PreviewRanuraEstandar, RolFormaPreview } from "../../../../api/graficos";

export type CapaGuia = "cajas" | "espacios" | "tipografia" | "medidas" | "recetario";

export const CAPAS_GUIA: readonly CapaGuia[] = ["cajas", "espacios", "tipografia", "medidas", "recetario"];

export type CapasGuias = Record<CapaGuia, boolean>;

export const CAPAS_APAGADAS: CapasGuias = { cajas: false, espacios: false, tipografia: false, medidas: false, recetario: false };

/** Tamaño de la lámina en pulgadas. La vista previa no lo declara: el estándar es 16:9 de 13,333 × 7,5 in. */
export type Lienzo = { ancho: number; alto: number };

export const LIENZO_ESTANDAR: Lienzo = { ancho: 13.333, alto: 7.5 };

export const CM_POR_PULGADA = 2.54;

/** Diferencia en pt que todavía cuenta como «el cuerpo del recetario» (el XML guarda centésimas de punto). */
export const TOLERANCIA_PT = 0.5;

/** Un hueco menor que esto (≈ 0,25 mm) es contacto, no separación. */
const HUECO_MINIMO_IN = 0.01;

/** Una caja que cubre casi toda la lámina es un fondo: no delimita secciones ni márgenes. */
const FRACCION_FONDO = 0.98;

export type Caja = { x: number; y: number; w: number; h: number };

export type Porcentaje = { left: number; top: number; width: number; height: number };

export const ROTULO_ROL: Record<RolFormaPreview, string> = {
  titulo: "Título",
  antetitulo: "Antetítulo",
  grafico: "Gráfico",
  cifra: "Cifra",
  texto: "Texto",
  leyenda: "Leyenda",
  base: "Base",
  pie: "Pie",
  icono: "Ícono",
  otro: "Otro",
};

const ORDEN_ROL: readonly RolFormaPreview[] = ["titulo", "antetitulo", "grafico", "cifra", "texto", "leyenda", "base", "pie", "icono", "otro"];

const esRol = (r: string): r is RolFormaPreview => (ORDEN_ROL as readonly string[]).includes(r);

export const rotuloDeRol = (rol: string): string => (esRol(rol) ? ROTULO_ROL[rol] : rol || "Ranura");

// ---- unidades ---------------------------------------------------------------

export const aCm = (pulgadas: number): number => pulgadas * CM_POR_PULGADA;

const decimal = (v: number, decimales: number): string => v.toFixed(decimales).replace(".", ",");

/** «0,46 cm». */
export const formatoCm = (pulgadas: number): string => `${decimal(aCm(pulgadas), 2)} cm`;

/** «24 pt», «10,5 pt». */
export const formatoPt = (pt: number): string => `${Number.isInteger(pt) ? String(pt) : decimal(pt, 1)} pt`;

/** La caja de una forma, o `null` si alguna medida falta o no tiene superficie. */
export function cajaDe(f: Pick<PreviewForma, "x" | "y" | "w" | "h">): Caja | null {
  const { x, y, w, h } = f;
  if (x === null || y === null || w === null || h === null) return null;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

const recortar = (v: number): number => Math.min(100, Math.max(0, v));

/** Caja en pulgadas → posición en % del lienzo, recortada a la lámina (lo que sale de la hoja no se dibuja). */
export function aPorcentaje(c: Caja, lienzo: Lienzo = LIENZO_ESTANDAR): Porcentaje {
  const left = recortar((c.x / lienzo.ancho) * 100);
  const top = recortar((c.y / lienzo.alto) * 100);
  const right = recortar(((c.x + c.w) / lienzo.ancho) * 100);
  const bottom = recortar(((c.y + c.h) / lienzo.alto) * 100);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Un punto en pulgadas → % del lienzo (sin recortar: las cotas parten del borde mismo). */
export const puntoAPorcentaje = (x: number, y: number, lienzo: Lienzo = LIENZO_ESTANDAR) => ({
  left: (x / lienzo.ancho) * 100,
  top: (y / lienzo.alto) * 100,
});

// ---- filtro por rol ---------------------------------------------------------

export function filtrarPorRol<T extends { rol: string }>(elementos: readonly T[], ocultos: readonly string[]): T[] {
  if (!ocultos.length) return [...elementos];
  const fuera = new Set(ocultos);
  return elementos.filter((e) => !fuera.has(e.rol));
}

/** Roles presentes en la parte (formas y ranuras), en orden de lectura, con cuántos elementos tiene cada uno. */
export function rolesPresentes(formas: readonly PreviewForma[], ranuras: readonly PreviewRanuraEstandar[] = []): { rol: string; n: number }[] {
  const cuenta = new Map<string, number>();
  for (const e of [...formas, ...ranuras]) cuenta.set(e.rol, (cuenta.get(e.rol) ?? 0) + 1);
  const orden = (r: string) => (esRol(r) ? ORDEN_ROL.indexOf(r) : ORDEN_ROL.length);
  return [...cuenta.entries()].map(([rol, n]) => ({ rol, n })).sort((a, b) => orden(a.rol) - orden(b.rol) || a.rol.localeCompare(b.rol));
}

// ---- tipografía -------------------------------------------------------------

/**
 * ¿El cuerpo del texto se aparta del recetario? Sólo se afirma con las dos cosas medidas: el cuerpo leído del PPTX y el
 * que pide el recetario. Sin referencia no hay marca roja (no se compara contra un valor inventado).
 */
export function fueraDeRecetario(f: Pick<PreviewForma, "ptMin" | "ptMax" | "ptEstandar">, tolerancia = TOLERANCIA_PT): boolean {
  if (f.ptEstandar === null) return false;
  const medidos = [f.ptMin, f.ptMax].filter((v): v is number => v !== null);
  const esperado = f.ptEstandar;
  return medidos.some((pt) => Math.abs(pt - esperado) > tolerancia);
}

export function rotuloPt(f: Pick<PreviewForma, "ptMin" | "ptMax">): string | null {
  const { ptMin, ptMax } = f;
  if (ptMin === null) return ptMax === null ? null : formatoPt(ptMax);
  if (ptMax === null || ptMin === ptMax) return formatoPt(ptMin);
  return `${Number.isInteger(ptMin) ? ptMin : decimal(ptMin, 1)}–${formatoPt(ptMax)}`;
}

// ---- espacios ---------------------------------------------------------------

export type Espacio = {
  id: string;
  /** «h»: la cota corre en horizontal (hueco entre columnas, márgenes izquierdo y derecho); «v», en vertical. */
  eje: "h" | "v";
  tipo: "separacion" | "margen";
  /** Extremos de la cota, en pulgadas. */
  desde: { x: number; y: number };
  hasta: { x: number; y: number };
  /** Lo que mide, en pulgadas. */
  valor: number;
};

const solapa = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

const esFondo = (c: Caja, lienzo: Lienzo) => c.w >= lienzo.ancho * FRACCION_FONDO && c.h >= lienzo.alto * FRACCION_FONDO;

/**
 * Separaciones entre secciones y márgenes a los bordes.
 *
 * - Secciones: las cajas de primer nivel (un grupo cuenta entero), sin fondos que cubran la lámina.
 * - Separación vertical: entre una caja y la más cercana de las que tiene debajo con las que comparte columna (sus
 *   proyecciones en x se solapan); horizontal, igual hacia la derecha compartiendo fila. Cajas que se tocan o se
 *   superponen no tienen separación.
 * - Márgenes: del bloque de contenido (la unión de las secciones) a cada borde, trazados desde la caja que lo fija.
 */
export function calcularEspacios(cajas: readonly Caja[], lienzo: Lienzo = LIENZO_ESTANDAR): Espacio[] {
  const secciones = cajas.filter((c) => !esFondo(c, lienzo));
  if (!secciones.length) return [];
  const salida: Espacio[] = [];
  for (let i = 0; i < secciones.length; i += 1) {
    const a = secciones[i];
    let abajo: { b: Caja; hueco: number } | null = null;
    let derecha: { b: Caja; hueco: number } | null = null;
    for (let j = 0; j < secciones.length; j += 1) {
      if (i === j) continue;
      const b = secciones[j];
      const huecoV = b.y - (a.y + a.h);
      if (huecoV > HUECO_MINIMO_IN && solapa(a.x, a.x + a.w, b.x, b.x + b.w) > 0 && (!abajo || huecoV < abajo.hueco)) abajo = { b, hueco: huecoV };
      const huecoH = b.x - (a.x + a.w);
      if (huecoH > HUECO_MINIMO_IN && solapa(a.y, a.y + a.h, b.y, b.y + b.h) > 0 && (!derecha || huecoH < derecha.hueco)) derecha = { b, hueco: huecoH };
    }
    if (abajo) {
      const { b, hueco } = abajo;
      const x = Math.max(a.x, b.x) + solapa(a.x, a.x + a.w, b.x, b.x + b.w) / 2;
      salida.push({ id: `v:${i}`, eje: "v", tipo: "separacion", desde: { x, y: a.y + a.h }, hasta: { x, y: b.y }, valor: hueco });
    }
    if (derecha) {
      const { b, hueco } = derecha;
      const y = Math.max(a.y, b.y) + solapa(a.y, a.y + a.h, b.y, b.y + b.h) / 2;
      salida.push({ id: `h:${i}`, eje: "h", tipo: "separacion", desde: { x: a.x + a.w, y }, hasta: { x: b.x, y }, valor: hueco });
    }
  }

  const menor = (medida: (c: Caja) => number) => secciones.reduce((m, c) => (medida(c) < medida(m) ? c : m), secciones[0]);
  const izq = menor((c) => c.x);
  const arr = menor((c) => c.y);
  const der = menor((c) => lienzo.ancho - (c.x + c.w));
  const aba = menor((c) => lienzo.alto - (c.y + c.h));
  const margenes: Espacio[] = [
    { id: "m:izquierdo", eje: "h", tipo: "margen", desde: { x: 0, y: izq.y + izq.h / 2 }, hasta: { x: izq.x, y: izq.y + izq.h / 2 }, valor: izq.x },
    { id: "m:derecho", eje: "h", tipo: "margen", desde: { x: der.x + der.w, y: der.y + der.h / 2 }, hasta: { x: lienzo.ancho, y: der.y + der.h / 2 }, valor: lienzo.ancho - (der.x + der.w) },
    { id: "m:superior", eje: "v", tipo: "margen", desde: { x: arr.x + arr.w / 2, y: 0 }, hasta: { x: arr.x + arr.w / 2, y: arr.y }, valor: arr.y },
    { id: "m:inferior", eje: "v", tipo: "margen", desde: { x: aba.x + aba.w / 2, y: aba.y + aba.h }, hasta: { x: aba.x + aba.w / 2, y: lienzo.alto }, valor: lienzo.alto - (aba.y + aba.h) },
  ];
  return [...salida, ...margenes.filter((m) => m.valor > HUECO_MINIMO_IN)];
}

// ---- lo que dibuja la capa --------------------------------------------------

export type CajaGuia = {
  id: string;
  rol: RolFormaPreview;
  /** Lo que se lee al pasar el mouse: el nombre de la forma, o su rol si el PPTX no la nombra. */
  nombre: string;
  grupo: string | null;
  caja: Caja;
  pos: Porcentaje;
  /** Rótulo de tipografía (capa Tipografía) y si se aparta del recetario. */
  pt: string | null;
  /** El recetario informa el cuerpo esperado de esta forma. */
  conReferencia: boolean;
  ptFuera: boolean;
  recortado: boolean;
  /** «12,52 × 4,60 cm» (capa Medidas). */
  medidas: string;
};

export type RanuraGuia = { id: string; rol: string; rotulo: string; pos: Porcentaje };

export type EspacioGuia = Espacio & { rotulo: string; desdePct: { left: number; top: number }; hastaPct: { left: number; top: number } };

export type ModeloGuias = {
  /** Algo que dibujar: alguna capa encendida y la respuesta trae formas. */
  activa: boolean;
  /** Todas las formas de la parte que pasan el filtro (base de la lista accesible y del hover). */
  elementos: CajaGuia[];
  cajas: CajaGuia[];
  tipografia: CajaGuia[];
  medidas: CajaGuia[];
  espacios: EspacioGuia[];
  recetario: RanuraGuia[];
  resumen: { elementos: number; textos: number; fueraDeRecetario: number; recortados: number; sinReferencia: boolean };
};

export const idForma = (parte: number, i: number) => `p${parte}-f${i}`;

export function construirGuias(
  datos: PreviewFormas | null,
  parte: number,
  capas: CapasGuias,
  rolesOcultos: readonly string[],
  lienzo: Lienzo = LIENZO_ESTANDAR,
): ModeloGuias {
  const formas = datos?.porParte[parte] ?? [];
  const elementos: CajaGuia[] = [];
  formas.forEach((f, i) => {
    const caja = cajaDe(f);
    if (!caja) return;
    elementos.push({
      id: idForma(parte, i),
      rol: f.rol,
      nombre: f.nombre || ROTULO_ROL[f.rol],
      grupo: f.grupo,
      caja,
      pos: aPorcentaje(caja, lienzo),
      pt: rotuloPt(f),
      conReferencia: f.ptEstandar !== null,
      ptFuera: fueraDeRecetario(f),
      recortado: f.recortado === true,
      medidas: `${decimal(aCm(caja.w), 2)} × ${formatoCm(caja.h)}`,
    });
  });
  const visibles = filtrarPorRol(elementos, rolesOcultos);
  const conTexto = visibles.filter((e) => e.pt !== null);

  const primerNivel = visibles.filter((e) => e.grupo === null).map((e) => e.caja);
  const espacios: EspacioGuia[] = capas.espacios
    ? calcularEspacios(primerNivel, lienzo).map((e) => ({
        ...e,
        rotulo: formatoCm(e.valor),
        desdePct: puntoAPorcentaje(e.desde.x, e.desde.y, lienzo),
        hastaPct: puntoAPorcentaje(e.hasta.x, e.hasta.y, lienzo),
      }))
    : [];

  const recetario: RanuraGuia[] = capas.recetario
    ? filtrarPorRol(datos?.ranuras ?? [], rolesOcultos).map((r, i) => ({
        id: `r${i}`,
        rol: r.rol,
        rotulo: rotuloDeRol(r.rol),
        pos: aPorcentaje(r, lienzo),
      }))
    : [];

  const hayAlgo = !!datos?.disponible && CAPAS_GUIA.some((c) => capas[c]);
  return {
    activa: hayAlgo,
    elementos: visibles,
    cajas: capas.cajas ? visibles : [],
    tipografia: capas.tipografia ? conTexto : [],
    medidas: capas.medidas ? visibles : [],
    espacios,
    recetario,
    resumen: {
      elementos: visibles.length,
      textos: conTexto.length,
      fueraDeRecetario: conTexto.filter((e) => e.ptFuera).length,
      recortados: visibles.filter((e) => e.recortado).length,
      sinReferencia: conTexto.length > 0 && conTexto.every((e) => !e.conReferencia),
    },
  };
}

/** La forma bajo el puntero (en pulgadas): la de menor superficie que lo contiene, para que un texto gane a su grupo. */
export function formaBajoPunto(elementos: readonly Pick<CajaGuia, "id" | "caja">[], x: number, y: number): string | null {
  let mejor: { id: string; area: number } | null = null;
  for (const e of elementos) {
    const c = e.caja;
    if (x < c.x || x > c.x + c.w || y < c.y || y > c.y + c.h) continue;
    const area = c.w * c.h;
    if (!mejor || area < mejor.area) mejor = { id: e.id, area };
  }
  return mejor?.id ?? null;
}
