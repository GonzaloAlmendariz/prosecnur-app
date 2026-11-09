// El universo de la cobertura por categorías de una variable (ADR 0140), sin React.
//
// `universo_categorias` guarda lo que el analista tecleó, por base: {modo: "conteos" | "porcentajes", total, variable,
// categorias: [{codigo, etiqueta, valor}]}. El motor deriva el % (graficos_cobertura_categorias.R). Aquí:
//   - se lee el guardado de forma defensiva;
//   - se arman las filas de la tabla con las categorías de la muestra (también las de n = 0) y lo tecleado, por código;
//   - se detecta un universo viejo (tecleado para otra variable o con categorías que la variable ya no tiene), igual que
//     el motor al dibujar; nunca se descarta en silencio;
//   - se calculan los avisos en vivo (suma de % fuera de 99.5–100.5; total distinto de la suma), que no bloquean.

import type { CategoriasDeBase } from "../../../../api/graficosCoberturaCategorias";
import { formatoDecimal } from "../../../../lib/formatoNumero";

export type ModoUniverso = "conteos" | "porcentajes";

export type CategoriaUniverso = { codigo: string; etiqueta: string; valor: number | null };

export type UniversoBase = {
  modo: ModoUniverso;
  total: number | null;
  /** La columna con que se tecleó (la `variable_usada` del endpoint). */
  variable: string | null;
  categorias: CategoriaUniverso[];
};

export type UniversoCategorias = Record<string, UniversoBase>;

export type FilaUniverso = {
  codigo: string;
  etiqueta: string;
  /** El n de la muestra; `null` si la categoría no está en la variable (sólo en el universo guardado). */
  n: number | null;
  valor: number | null;
};

/** Args que sólo existen en la versión "Por categorías de una variable" (se quitan al volver a "Por públicos"). */
export const ARGS_VERSION_CATEGORIAS = ["modo", "variable", "universo_categorias", "tolerancia_pts"] as const;

/** Args de la versión "Por públicos" que la de categorías no lee (los `args_quitar` de la variante). */
export const ARGS_VERSION_PUBLICOS = ["universos", "metas", "extras", "universos_no_confiables"] as const;

export const SUMA_PCT: readonly [number, number] = [99.5, 100.5];

const ARGS_CATEGORIAS: ReadonlySet<string> = new Set(ARGS_VERSION_CATEGORIAS.filter((a) => a !== "modo"));
const ARGS_PUBLICOS: ReadonlySet<string> = new Set(ARGS_VERSION_PUBLICOS);

/** ¿La cobertura está en la versión por categorías? Espejo de `.graficos_variante_de` (api/R/graficos_variantes.R). */
export function esCoberturaCategorias(graficador: string, args: Readonly<Record<string, unknown>>): boolean {
  if (graficador !== "p_cobertura") return false;
  const m = Array.isArray(args.modo) ? args.modo[0] : args.modo;
  return typeof m === "string" && m.trim() === "categorias";
}

/**
 * ¿El arg se muestra en la versión actual de la cobertura? Los de una versión se esconden en la otra. El registro sólo
 * declara `depende` en los de categorías; los de públicos no lo tienen, así que la regla vive aquí para los dos lados.
 * Fuera de `p_cobertura`, siempre.
 */
export function argDeLaVersion(graficador: string, args: Readonly<Record<string, unknown>>, name: string): boolean {
  if (graficador !== "p_cobertura") return true;
  return esCoberturaCategorias(graficador, args) ? !ARGS_PUBLICOS.has(name) : !ARGS_CATEGORIAS.has(name);
}

/** La tolerancia que se guarda: un número mayor que cero, en puntos; vacío o 0 es `null` (la lámina no la menciona). */
export function toleranciaAGuardar(v: unknown): number | null {
  const n = numeroUniverso(v);
  return n !== null && n > 0 ? n : null;
}

const comoObjeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);

const comoTexto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x.trim() : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};

/**
 * Un número no negativo tecleado; vacío o inválido es `null`. Con la convención es-PE la coma separa millares
 * ("1,234" vale 1234); una coma suelta que no lo es se lee como decimal ("12,5" vale 12.5).
 */
export function numeroUniverso(v: unknown): number | null {
  const x = escalar(v);
  if (typeof x === "number") return Number.isFinite(x) && x >= 0 ? x : null;
  if (typeof x !== "string") return null;
  const limpio = x.trim().replace(/\s/g, "");
  const t = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(limpio) ? limpio.replace(/,/g, "") : limpio.replace(",", ".");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** El universo guardado, defensivo: una base sin categorías ni total no cuenta; un código repetido se queda una vez. */
export function leerUniverso(raw: unknown): UniversoCategorias {
  const out: UniversoCategorias = {};
  for (const [base, u] of Object.entries(comoObjeto(raw))) {
    const b = base.trim();
    const o = comoObjeto(u);
    if (!b || !Object.keys(o).length) continue;
    const modo: ModoUniverso = comoTexto(o.modo) === "porcentajes" ? "porcentajes" : "conteos";
    const vistos = new Set<string>();
    const categorias = (Array.isArray(o.categorias) ? o.categorias : []).flatMap((c): CategoriaUniverso[] => {
      const k = comoObjeto(c);
      const codigo = comoTexto(k.codigo);
      if (!codigo || vistos.has(codigo)) return [];
      vistos.add(codigo);
      return [{ codigo, etiqueta: comoTexto(k.etiqueta), valor: numeroUniverso(k.valor) }];
    });
    out[b] = { modo, total: numeroUniverso(o.total), variable: comoTexto(o.variable) || null, categorias };
  }
  return out;
}

const sinBase = (v: string): string => v.replace(/^.*\$/, "").trim();

/**
 * ¿El universo guardado de la base es viejo frente a lo que la variable trae hoy? Como el motor: tecleado para otra
 * variable (ni la de la lámina ni la que se contó), o ninguna de sus categorías está en la variable.
 */
export function universoViejo(guardado: UniversoBase | undefined, variableLamina: string, deLaBase: CategoriasDeBase | undefined): boolean {
  if (!guardado || !deLaBase) return false;
  const actual = new Set([sinBase(variableLamina), deLaBase.variable_usada].filter(Boolean));
  if (guardado.variable && actual.size && !actual.has(sinBase(guardado.variable))) return true;
  const codigos = new Set(deLaBase.categorias.map((c) => c.codigo));
  const conValor = guardado.categorias.filter((c) => c.valor !== null);
  return codigos.size > 0 && conValor.length > 0 && conValor.every((c) => !codigos.has(c.codigo));
}

/**
 * Las filas de la tabla de una base. Con las categorías de la muestra: una por categoría (también n = 0), con lo
 * tecleado por código, y al final las del guardado que la variable no trae (no se borran). Sin ellas, o con el universo
 * viejo, las del guardado tal cual (sin n).
 */
export function filasDeBase(guardado: UniversoBase | undefined, deLaBase: CategoriasDeBase | undefined, viejo: boolean): FilaUniverso[] {
  const previas = guardado?.categorias ?? [];
  if (!deLaBase || viejo) return previas.map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta || c.codigo, n: null, valor: c.valor }));
  const porCodigo = new Map(previas.map((c) => [c.codigo, c]));
  const filas: FilaUniverso[] = deLaBase.categorias.map((c) => ({
    codigo: c.codigo, etiqueta: c.etiqueta, n: c.n, valor: porCodigo.get(c.codigo)?.valor ?? null,
  }));
  const vistas = new Set(filas.map((f) => f.codigo));
  for (const c of previas) {
    if (!vistas.has(c.codigo)) filas.push({ codigo: c.codigo, etiqueta: c.etiqueta || c.codigo, n: null, valor: c.valor });
  }
  return filas;
}

/** El universo de la base tal como queda al escribir: todas las filas a la vista, con lo tecleado y la variable contada. */
export function baseAGuardar(
  filas: readonly FilaUniverso[], modo: ModoUniverso, total: number | null, variable: string | null,
): UniversoBase {
  return {
    modo,
    total: modo === "conteos" ? total : null,
    variable: variable || null,
    categorias: filas.map((f) => ({ codigo: f.codigo, etiqueta: f.etiqueta, valor: f.valor })),
  };
}

/** Reemplaza el universo de una base y conserva las demás (también las que hoy no están en la lámina). */
export function conBase(universo: UniversoCategorias, base: string, bloque: UniversoBase): UniversoCategorias {
  return { ...universo, [base]: bloque };
}

/** Rellenar la base con las categorías actuales de la variable: el analista lo pide; los valores vuelven a vacío. */
export function rellenarBase(deLaBase: CategoriasDeBase, modo: ModoUniverso): UniversoBase {
  return {
    modo, total: null, variable: deLaBase.variable_usada || null,
    categorias: deLaBase.categorias.map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta, valor: null })),
  };
}

const sumar = (filas: readonly FilaUniverso[]): number => filas.reduce((s, f) => s + (f.valor ?? 0), 0);

const formato = (n: number, decimales: number): string => formatoDecimal(n, decimales);

/**
 * El aviso en vivo de la base, o `null`. No bloquea: el motor dibuja lo tecleado y dice lo mismo en la lámina.
 *   - porcentajes: la suma de lo tecleado fuera de 99.5–100.5;
 *   - conteos: un total tecleado distinto de la suma de las categorías (la lámina usa la suma).
 */
export function avisoDeBase(filas: readonly FilaUniverso[], modo: ModoUniverso, total: number | null): string | null {
  const tecleadas = filas.filter((f) => f.valor !== null);
  if (!tecleadas.length) return null;
  const suma = sumar(tecleadas);
  if (modo === "porcentajes") {
    if (suma >= SUMA_PCT[0] && suma <= SUMA_PCT[1]) return null;
    return `Los porcentajes suman ${formato(suma, 1)} %; deberían sumar 100 %. La lámina los dibuja como están.`;
  }
  if (total === null || Math.abs(total - suma) < 1e-9) return null;
  return `El total (${formato(total, 2)}) no coincide con la suma de las categorías (${formato(suma, 2)}). La lámina usa la suma.`;
}

/** La suma que se muestra al pie de la columna: % o casos. */
export function sumaDeBase(filas: readonly FilaUniverso[]): number | null {
  const tecleadas = filas.filter((f) => f.valor !== null);
  return tecleadas.length ? sumar(tecleadas) : null;
}

export type CambioDeModo = { filas: FilaUniverso[]; total: number | null; aviso: string | null };

const redondear = (n: number, decimales: number): number => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

/**
 * Pasar la tabla de un modo al otro (ronda 19, O1): las cifras tecleadas se convierten, nunca se reinterpretan en silencio
 * (30 casos no pasan a ser 30 %).
 *   - conteos → porcentajes: sobre el total; sin total, sobre la suma de las categorías. Un decimal.
 *   - porcentajes → conteos: hace falta un total, y en porcentajes no se guarda (ADR 0140). Las celdas quedan vacías y
 *     el aviso lo dice.
 * Sin cifras tecleadas sólo cambia el modo. `aviso` dice qué se hizo con lo tecleado.
 */
export function cambioDeModo(
  filas: readonly FilaUniverso[], desde: ModoUniverso, hacia: ModoUniverso, total: number | null,
): CambioDeModo {
  const tecleadas = filas.filter((f) => f.valor !== null);
  if (desde === hacia || !tecleadas.length) return { filas: [...filas], total, aviso: null };
  if (hacia === "porcentajes") {
    const suma = sumar(tecleadas);
    const conTotal = total !== null && total > 0;
    const denominador = conTotal ? total : suma;
    if (!(denominador > 0)) {
      return { filas: filas.map((f) => ({ ...f, valor: null })), total: null, aviso: "Los conteos suman 0: no hay % que calcular. Teclea los porcentajes." };
    }
    return {
      filas: filas.map((f) => ({ ...f, valor: f.valor === null ? null : redondear((100 * f.valor) / denominador, 1) })),
      total: null,
      aviso: conTotal
        ? `Los conteos pasaron a % sobre el total (${formato(denominador, 0)}).`
        : `Los conteos pasaron a % sobre su suma (${formato(denominador, 0)}): no había total.`,
    };
  }
  return {
    filas: filas.map((f) => ({ ...f, valor: null })),
    total,
    aviso: "Sin total, los % no se pueden pasar a casos: las celdas quedan vacías. Escribe el total y los conteos.",
  };
}
