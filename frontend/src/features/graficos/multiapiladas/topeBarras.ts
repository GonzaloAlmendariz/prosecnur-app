// Una multiapilada lleva a lo más seis barras (Gonzalo, 2026-10-14: «mejor limitamos multiapiladas a 6 barras
// únicamente»). El motor aplica la misma cifra en `api/R/graficos_multiapiladas_tope.R`; aquí se cuenta lo que el
// editor sabe para avisar antes de exportar y no dejar agregar la séptima.
//
// Una barra es una fila dibujada:
//   - `var`: una por pregunta de `vars`;
//   - `var_cruce` con públicos (`vars` = {tema: [refs]}): una por referencia de cada tema;
//   - `multilista`: la suma de sus bloques.
// Los modos que abren por las categorías de un grupo (`cruce`, `var_cruce` con `cruces`) no se cuentan: el editor no
// sabe cuántas categorías saldrán y el motor avisa por su cuenta. Esa parte no suma, y el conteo deja de ser exacto.

export const MAX_BARRAS_MULTIAPILADAS = 6;

export type ConteoBarras = {
  /** Barras que el editor puede contar (con bloques por grupos, es un mínimo). */
  barras: number;
  /** `false` si alguna parte abre por categorías y no se pudo contar. */
  exacto: boolean;
};

const refsDe = (valor: unknown): string[] => {
  if (typeof valor === "string") return valor.trim() ? [valor] : [];
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return [];
};

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  !!valor && typeof valor === "object" && !Array.isArray(valor);

const tieneCruce = (args: Record<string, unknown>) => refsDe(args.cruces).length > 0 || refsDe(args.cruce).length > 0;

function conteoDe(args: Record<string, unknown>, anidado: boolean): ConteoBarras {
  const modo = typeof args.modo === "string" && args.modo ? args.modo : "var";
  if (modo === "multilista") {
    // Un bloque no puede ser otro «Combinar bloques»: no se sabe qué dibujaría.
    if (anidado) return { barras: 0, exacto: false };
    const bloques = Array.isArray(args.bloques) ? args.bloques.filter(esObjeto) : [];
    return bloques.reduce<ConteoBarras>((acc, b) => {
      const c = conteoDe(b, true);
      return { barras: acc.barras + c.barras, exacto: acc.exacto && c.exacto };
    }, { barras: 0, exacto: true });
  }
  if (modo === "cruce") return { barras: 0, exacto: false };
  if (modo === "var_cruce") {
    if (tieneCruce(args) || !esObjeto(args.vars)) return { barras: 0, exacto: false };
    const barras = Object.values(args.vars).reduce<number>((acc, refs) => acc + refsDe(refs).length, 0);
    return { barras, exacto: true };
  }
  if (modo === "var") return { barras: refsDe(args.vars).length, exacto: true };
  return { barras: 0, exacto: false };
}

/** Lo que el editor sabe de las barras de una multiapilada. */
export function conteoBarrasMultiapiladas(args: Record<string, unknown> | null | undefined): ConteoBarras {
  return conteoDe(args ?? {}, false);
}

/** Barras de una multiapilada, o `null` si alguna parte abre por categorías y no se puede contar. */
export function contarBarrasMultiapiladas(args: Record<string, unknown> | null | undefined): number | null {
  const c = conteoBarrasMultiapiladas(args);
  return c.exacto ? c.barras : null;
}

/** ¿Pasa del tope? Con un conteo parcial, sólo si lo contado ya pasa. */
export function excedeTope(c: ConteoBarras): boolean {
  return c.barras > MAX_BARRAS_MULTIAPILADAS;
}

/** Barras que todavía caben. Nunca negativo. */
export function cupoBarras(c: ConteoBarras): number {
  return Math.max(0, MAX_BARRAS_MULTIAPILADAS - c.barras);
}

/** En cuántas láminas hay que partir `barras` para que ninguna pase del tope. */
export function laminasNecesarias(barras: number): number {
  return Math.max(1, Math.ceil(barras / MAX_BARRAS_MULTIAPILADAS));
}

/** «N de 6 barras», o «Al menos N de 6 barras» si una parte abre por categorías. */
export function rotuloConteoBarras(c: ConteoBarras): string {
  const base = `${c.barras} de ${MAX_BARRAS_MULTIAPILADAS} barras`;
  return c.exacto ? base : `Al menos ${base}`;
}

type TemaConRefs = { vars: readonly string[] };

/**
 * ¿Cabe otro tema en «Públicos por tema»? Un tema nuevo ocupará lo que ocupan los que ya tienen preguntas (o todos los
 * públicos si ninguno tiene), y un tema todavía vacío ya reserva ese mismo lugar: si no, se podían sembrar temas vacíos
 * y pasar de seis al llenarlos.
 */
export function cabeOtroTema(temas: readonly TemaConRefs[], publicos: number, cupo: number): boolean {
  const ancho = Math.max(0, ...temas.map((t) => t.vars.length)) || Math.max(1, publicos);
  const reservado = temas.filter((t) => t.vars.length === 0).length * ancho;
  return cupo - reservado >= ancho;
}

/** Texto breve para un «agregar» deshabilitado por el tope. */
export const MOTIVO_TOPE = `Una multiapilada lleva hasta ${MAX_BARRAS_MULTIAPILADAS} barras.`;
