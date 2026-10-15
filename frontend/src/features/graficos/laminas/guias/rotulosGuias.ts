// Colocación de los rótulos de las guías sobre la hoja (plan F6 §8; QA A3, defecto 1). Lógica pura: del modelo de
// guías y del tamaño en px de la hoja a qué rótulos se pintan y dónde. Cuatro reglas, en este orden:
//
//   1. Un rótulo por caja: si Tipografía y Medidas rotulan la misma forma, sale un solo rótulo combinado
//      («14 pt · 1,78 × 0,76 cm»); si no cabe a lo ancho de su caja, se queda con la parte más importante que quepa.
//   2. Umbral: una caja (o ranura) más chica que UMBRAL_CAJA_PX no rotula en línea. Conserva su contorno, y su dato
//      sigue en la lista del panel y al pasar el mouse.
//   3. Dentro de la hoja: el rótulo se desplaza para no salir por ningún borde (la hoja recorta lo que sale).
//   4. Sin choques: los candidatos se ordenan por prioridad estable (rol: título > gráfico > texto > cotas > el resto;
//      luego la superficie, mayor primero; luego el id) y uno que pisa a otro ya colocado no se pinta.
//
// Las medidas de un rótulo se estiman (cuerpo fijo de 10 px de la capa, guias.css): la estimación es holgada a
// propósito; equivocarse hacia arriba sólo oculta un rótulo de más, que sigue en la lista del panel.

import type { CajaGuia, EspacioGuia, ModeloGuias, RanuraGuia } from "./modeloGuias";

/** Tamaño de la hoja en px de pantalla. */
export type HojaPx = { ancho: number; alto: number };

/** Una caja por debajo de esto (px) no pinta rótulo en línea: el rótulo (16 px de alto) no le cabe. */
export const UMBRAL_CAJA_PX = { ancho: 40, alto: 16 } as const;

/** Estimación del rótulo: ancho por carácter a 10 px semibold (holgado), relleno + borde y alto de línea + borde. */
export const ANCHO_CARACTER_PX = 6.4;
export const RELLENO_ROTULO_PX = 10;
export const ALTO_ROTULO_PX = 16;
/** Separación del rótulo al borde de su caja. */
const SANGRIA_PX = 2;
/** Dos rótulos a menos de esto se consideran pegados (cuenta como choque). */
export const SEPARACION_MINIMA_PX = 1;

export type TonoParte = "pt" | "pt-fuera" | "recorte" | "medida" | "cota" | "ranura";

export type ParteRotulo = { texto: string; tono: TonoParte };

export type RotuloColocado = {
  id: string;
  tipo: "caja" | "cota" | "ranura";
  partes: ParteRotulo[];
  texto: string;
  /** Posición y tamaño estimado, en px de la hoja. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Lo mismo en % de la hoja, para el estilo (sobrevive a un cambio de tamaño hasta el siguiente cálculo). */
  pct: { left: number; top: number; maxWidth: number };
};

export type Rect = { x: number; y: number; ancho: number; alto: number };

/** Prioridad por rol (menor gana). Las cotas de Espacios van entre el texto y el resto. */
const PRIORIDAD_ROL: Record<string, number> = {
  titulo: 0,
  grafico: 1,
  texto: 2,
  antetitulo: 4,
  cifra: 5,
  leyenda: 6,
  base: 7,
  pie: 8,
  icono: 9,
  otro: 10,
};
export const PRIORIDAD_COTA = 3;
const PRIORIDAD_DESCONOCIDA = 11;

export const prioridadDeRol = (rol: string): number => PRIORIDAD_ROL[rol] ?? PRIORIDAD_DESCONOCIDA;

export const textoDe = (partes: readonly ParteRotulo[]): string => partes.map((p) => p.texto).join(", ");

export function medirRotulo(texto: string): { ancho: number; alto: number } {
  return { ancho: Math.ceil([...texto].length * ANCHO_CARACTER_PX + RELLENO_ROTULO_PX), alto: ALTO_ROTULO_PX };
}

/** ¿Se pisan? Con la separación mínima: dos rótulos pegados también chocan. */
export function chocan(a: Rect, b: Rect, separacion = SEPARACION_MINIMA_PX): boolean {
  return a.x < b.x + b.ancho + separacion && b.x < a.x + a.ancho + separacion
    && a.y < b.y + b.alto + separacion && b.y < a.y + a.alto + separacion;
}

/** Desplaza el rectángulo para que quede entero dentro de la hoja; si es más ancho que la hoja, se ajusta a ella. */
export function dentroDeLaHoja(r: Rect, hoja: HojaPx): Rect {
  const ancho = Math.min(r.ancho, hoja.ancho);
  const alto = Math.min(r.alto, hoja.alto);
  return {
    x: Math.min(Math.max(r.x, 0), hoja.ancho - ancho),
    y: Math.min(Math.max(r.y, 0), hoja.alto - alto),
    ancho,
    alto,
  };
}

const enPx = (pos: CajaGuia["pos"], hoja: HojaPx): Rect => ({
  x: (pos.left / 100) * hoja.ancho,
  y: (pos.top / 100) * hoja.alto,
  ancho: (pos.width / 100) * hoja.ancho,
  alto: (pos.height / 100) * hoja.alto,
});

export const superaUmbral = (r: Pick<Rect, "ancho" | "alto">): boolean =>
  r.ancho >= UMBRAL_CAJA_PX.ancho && r.alto >= UMBRAL_CAJA_PX.alto;

type Candidato = { id: string; tipo: RotuloColocado["tipo"]; partes: ParteRotulo[]; rect: Rect; prioridad: number; area: number };

/**
 * Variantes del rótulo de una caja, de la más completa a la más corta. La tipografía va primero (es lo que se revisa
 * contra el recetario); el «recortado» acompaña al cuerpo.
 */
export function variantesDeCaja(e: CajaGuia, conPt: boolean, conMedidas: boolean): ParteRotulo[][] {
  const pt: ParteRotulo[] = conPt && e.pt
    ? [{ texto: e.pt, tono: e.ptFuera ? "pt-fuera" : "pt" }, ...(e.recortado ? [{ texto: "recortado", tono: "recorte" as const }] : [])]
    : [];
  const medidas: ParteRotulo[] = conMedidas ? [{ texto: e.medidas, tono: "medida" }] : [];
  const variantes: ParteRotulo[][] = [];
  if (pt.length && medidas.length) variantes.push([...pt, ...medidas]);
  if (pt.length) variantes.push(pt);
  if (pt.length > 1) variantes.push(pt.slice(0, 1));
  if (medidas.length) variantes.push(medidas);
  return variantes;
}

function candidatosDeCajas(modelo: ModeloGuias, hoja: HojaPx): Candidato[] {
  const conPt = new Set(modelo.tipografia.map((e) => e.id));
  const conMedidas = new Set(modelo.medidas.map((e) => e.id));
  const vistos = new Set<string>();
  const salida: Candidato[] = [];
  for (const e of [...modelo.tipografia, ...modelo.medidas]) {
    if (vistos.has(e.id)) continue;
    vistos.add(e.id);
    const caja = enPx(e.pos, hoja);
    if (!superaUmbral(caja)) continue;
    const variantes = variantesDeCaja(e, conPt.has(e.id), conMedidas.has(e.id));
    if (!variantes.length) continue;
    const espacio = caja.ancho - 2 * SANGRIA_PX;
    const partes = variantes.find((v) => medirRotulo(textoDe(v)).ancho <= espacio) ?? variantes[variantes.length - 1];
    const { ancho, alto } = medirRotulo(textoDe(partes));
    salida.push({
      id: `c:${e.id}`,
      tipo: "caja",
      partes,
      rect: { x: caja.x + SANGRIA_PX, y: caja.y + SANGRIA_PX, ancho, alto },
      prioridad: prioridadDeRol(e.rol),
      area: caja.ancho * caja.alto,
    });
  }
  return salida;
}

function candidatosDeCotas(espacios: readonly EspacioGuia[], hoja: HojaPx): Candidato[] {
  return espacios.map((s) => {
    const partes: ParteRotulo[] = [{ texto: s.rotulo, tono: "cota" }];
    const { ancho, alto } = medirRotulo(s.rotulo);
    const cx = (((s.desdePct.left + s.hastaPct.left) / 2) / 100) * hoja.ancho;
    const cy = (((s.desdePct.top + s.hastaPct.top) / 2) / 100) * hoja.alto;
    const largo = s.eje === "h"
      ? (Math.abs(s.hastaPct.left - s.desdePct.left) / 100) * hoja.ancho
      : (Math.abs(s.hastaPct.top - s.desdePct.top) / 100) * hoja.alto;
    return { id: `e:${s.id}`, tipo: "cota", partes, rect: { x: cx - ancho / 2, y: cy - alto / 2, ancho, alto }, prioridad: PRIORIDAD_COTA, area: largo * alto };
  });
}

function candidatosDeRanuras(recetario: readonly RanuraGuia[], hoja: HojaPx): Candidato[] {
  const salida: Candidato[] = [];
  for (const r of recetario) {
    const caja = enPx(r.pos, hoja);
    if (!superaUmbral(caja)) continue;
    const partes: ParteRotulo[] = [{ texto: r.rotulo, tono: "ranura" }];
    const { ancho, alto } = medirRotulo(r.rotulo);
    salida.push({
      id: `r:${r.id}`,
      tipo: "ranura",
      partes,
      rect: { x: caja.x + caja.ancho - ancho - SANGRIA_PX, y: caja.y + SANGRIA_PX, ancho, alto },
      // Las ranuras son una capa aparte: a igualdad de rol ceden ante las formas medidas.
      prioridad: prioridadDeRol(r.rol) + 0.5,
      area: caja.ancho * caja.alto,
    });
  }
  return salida;
}

/** Orden estable de prioridad: rol, superficie (mayor primero), id. */
export const compararCandidatos = (a: Pick<Candidato, "prioridad" | "area" | "id">, b: Pick<Candidato, "prioridad" | "area" | "id">): number =>
  a.prioridad - b.prioridad || b.area - a.area || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Los rótulos que se pintan, ya dentro de la hoja y sin pisarse. Sin tamaño medido de la hoja, ninguno. */
export function colocarRotulos(modelo: ModeloGuias, hoja: HojaPx): RotuloColocado[] {
  if (!(hoja.ancho > 0 && hoja.alto > 0)) return [];
  const candidatos = [
    ...candidatosDeCajas(modelo, hoja),
    ...candidatosDeCotas(modelo.espacios, hoja),
    ...candidatosDeRanuras(modelo.recetario, hoja),
  ].sort(compararCandidatos);
  const colocados: RotuloColocado[] = [];
  for (const c of candidatos) {
    const r = dentroDeLaHoja(c.rect, hoja);
    if (colocados.some((o) => chocan(o, r))) continue;
    colocados.push({
      id: c.id,
      tipo: c.tipo,
      partes: c.partes,
      texto: textoDe(c.partes),
      ...r,
      pct: { left: (r.x / hoja.ancho) * 100, top: (r.y / hoja.alto) * 100, maxWidth: ((hoja.ancho - r.x) / hoja.ancho) * 100 },
    });
  }
  return colocados;
}

/** El dato de una forma para la etiqueta del mouse, según las capas que la rotulan (aunque su rótulo no se pinte). */
export function datoDeForma(modelo: ModeloGuias, id: string): string | null {
  const t = modelo.tipografia.find((e) => e.id === id);
  const m = modelo.medidas.find((e) => e.id === id);
  const e = t ?? m;
  if (!e) return null;
  const v = variantesDeCaja(e, !!t, !!m)[0];
  return v ? textoDe(v) : null;
}

/** Clases del rótulo: su tipo y lo que lleva (`is-pt`, `is-fuera`, `is-medida`), para el color y para el QA. */
export function clasesDeRotulo(r: Pick<RotuloColocado, "tipo" | "partes">): string {
  const tonos = new Set(r.partes.map((p) => p.tono));
  const clases = ["pulso-f6-guia-rotulo", `is-${r.tipo}`];
  if (tonos.has("pt") || tonos.has("pt-fuera")) clases.push("is-pt");
  if (tonos.has("pt-fuera")) clases.push("is-fuera");
  if (tonos.has("medida")) clases.push("is-medida");
  return clases.join(" ");
}
