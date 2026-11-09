// Padrón, meta y filas extra de las láminas de resumen (ADR 0135 §6; maqueta graficos-sintesis, Grupos). Modelo puro.
//
// Formatos que el motor lee (no se inventan aquí):
//   - `universos`: «Docentes TC: 24; Docentes TP: 91» (`.contraste_universos`, graficos_espec_contraste.R). Sólo los
//     padrones CONFIABLES: con ellos la base se escribe «n (cobertura %)»; sin padrón, sólo n.
//   - `universos_no_confiables`: el mismo formato. El motor no calcula con él: guarda el número tecleado de un grupo con
//     «Padrón confiable» apagado, para que apagar no borre lo escrito.
//   - `metas`: «Docentes: 60%» (porcentaje del padrón) o «Docentes: 74» (casos) (`.cobertura_metas`). El decimal va con
//     punto: el motor lee la coma como decimal en las metas.
//   - `extras`: lista de `{cifra, rotulo, detalle}`; el motor también acepta el texto «34 | egresados(as) | en 4 grupos».
// Los nombres se emparejan sin tildes ni mayúsculas (`.contraste_clave`), así que «docentes» casa con «Docentes».

import type { PadronPropuesto, UnidadMeta } from "../../../../api/graficosPadron";
import { esEntreGrupos } from "../brecha/modeloBrechaGrupos";

type Args = Readonly<Record<string, unknown>>;

export type EntradaPadron = { nombre: string; valor: number };
export type Padron = { valor: number | null; confiable: boolean };
export type Meta = { valor: number; unidad: UnidadMeta };
export type FilaExtra = { cifra: string; rotulo: string; detalle: string };

/** Umbral del grupo chico: el mismo del motor (`.GRUPO_CHICO_UMBRAL`, graficos_dumbbell_grupo_chico.R). */
export const UMBRAL_GRUPO_CHICO = 30;

/** Nombre comparable, como `.contraste_clave`: sin tildes, mayúsculas ni espacios sobrantes. */
export function clavePadron(nombre: string): string {
  return nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** El nombre de un público como lo rotula el motor (`.radar_mb_capitalizar`): primera letra en mayúscula. */
export function nombrePublico(base: string): string {
  const b = base.trim();
  return b ? b.charAt(0).toUpperCase() + b.slice(1) : b;
}

const partes = (texto: string): string[] => texto.split(/[;\n]/).map((p) => p.trim()).filter(Boolean);

/** Entero positivo de un texto como lo lee el motor («1,234» y «1.234» son 1234); `null` si no hay. */
export function numeroDePadron(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const limpio = v.trim().replace(/[.,\s]/g, "");
  if (!/^[0-9]+$/.test(limpio)) return null;
  const n = Number(limpio);
  return n > 0 ? n : null;
}

/** Las entradas de un padrón en texto («A: 1; B: 2») o en objeto ({A: 1}); en su orden y sin claves repetidas. */
export function leerPadrones(v: unknown): EntradaPadron[] {
  const crudas: [string, unknown][] = typeof v === "string"
    ? partes(v).flatMap((p): [string, unknown][] => {
      const m = /^(.+?)\s*[:=]\s*([0-9][0-9.,]*)\s*$/.exec(p);
      return m ? [[m[1].trim(), m[2]]] : [];
    })
    : v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>) : [];
  const vistas = new Set<string>();
  return crudas.flatMap(([nombre, valor]) => {
    const k = clavePadron(nombre);
    const n = numeroDePadron(valor);
    if (!k || n === null || vistas.has(k)) return [];
    vistas.add(k);
    return [{ nombre: nombre.trim(), valor: n }];
  });
}

/** El texto que se guarda; `null` sin entradas (el arg se quita y el motor queda sin padrón). */
export function escribirPadrones(entradas: readonly EntradaPadron[]): string | null {
  return entradas.length ? entradas.map((e) => `${e.nombre}: ${e.valor}`).join("; ") : null;
}

const buscar = (entradas: readonly EntradaPadron[], nombre: string) => {
  const k = clavePadron(nombre);
  return entradas.find((e) => clavePadron(e.nombre) === k) ?? null;
};

/**
 * El padrón de un grupo o público: el confiable manda; si no, el guardado con el interruptor apagado. Sin nada escrito,
 * «Padrón confiable» arranca apagado: teclear un padrón no lo enciende; lo decide el analista (R8-6).
 */
export function padronDe(args: Args, nombre: string): Padron {
  const confiable = buscar(leerPadrones(args.universos), nombre);
  if (confiable) return { valor: confiable.valor, confiable: true };
  const guardado = buscar(leerPadrones(args.universos_no_confiables), nombre);
  return guardado ? { valor: guardado.valor, confiable: false } : { valor: null, confiable: false };
}

/** Reemplaza (o quita, con `null`) la entrada de un nombre conservando el orden de las demás. */
function conEntrada(entradas: readonly EntradaPadron[], nombre: string, valor: number | null): EntradaPadron[] {
  const k = clavePadron(nombre);
  const i = entradas.findIndex((e) => clavePadron(e.nombre) === k);
  if (valor === null) return entradas.filter((_, j) => j !== i);
  if (i < 0) return [...entradas, { nombre, valor }];
  return entradas.map((e, j) => (j === i ? { nombre, valor } : e));
}

/**
 * El parche que escribe el padrón de un grupo. Confiable va a `universos`; apagado, a `universos_no_confiables` si el
 * graficador lo admite (`guardaNoConfiables`) y, si no, se quita: el motor nunca recibe un arg que no conoce.
 */
export function conPadron(args: Args, nombre: string, padron: Padron, guardaNoConfiables: boolean): Record<string, unknown> {
  const confiables = conEntrada(leerPadrones(args.universos), nombre, padron.confiable ? padron.valor : null);
  const patch: Record<string, unknown> = { universos: escribirPadrones(confiables) };
  if (guardaNoConfiables) {
    const otros = conEntrada(leerPadrones(args.universos_no_confiables), nombre, padron.confiable ? null : padron.valor);
    patch.universos_no_confiables = escribirPadrones(otros);
  }
  return patch;
}

// --- Metas -------------------------------------------------------------------------------------------------------

export function leerMetas(v: unknown): { nombre: string; meta: Meta }[] {
  const crudas: [string, string][] = typeof v === "string"
    ? partes(v).flatMap((p): [string, string][] => {
      const m = /^(.+?)\s*[:=]\s*([0-9][0-9.,]*\s*%?)\s*$/.exec(p);
      return m ? [[m[1].trim(), m[2]]] : [];
    })
    : v && typeof v === "object" && !Array.isArray(v)
      ? Object.entries(v as Record<string, unknown>).map(([k, x]): [string, string] => [k, typeof x === "number" ? String(x) : typeof x === "string" ? x : ""])
      : [];
  const vistas = new Set<string>();
  return crudas.flatMap(([nombre, crudo]) => {
    const k = clavePadron(nombre);
    const pct = /%\s*$/.test(crudo);
    const n = Number(crudo.replace(/[%\s]/g, "").replace(",", "."));
    if (!k || !crudo.trim() || !Number.isFinite(n) || n < 0 || vistas.has(k)) return [];
    vistas.add(k);
    return [{ nombre: nombre.trim(), meta: { valor: n, unidad: pct ? "porcentaje" : "casos" } }];
  });
}

export function metaDe(args: Args, nombre: string): Meta | null {
  const k = clavePadron(nombre);
  return leerMetas(args.metas).find((m) => clavePadron(m.nombre) === k)?.meta ?? null;
}

const textoMeta = (m: Meta) => (m.unidad === "porcentaje" ? `${m.valor}%` : String(m.valor));

export function conMeta(args: Args, nombre: string, meta: Meta | null): Record<string, unknown> {
  const k = clavePadron(nombre);
  const actuales = leerMetas(args.metas);
  const i = actuales.findIndex((m) => clavePadron(m.nombre) === k);
  const nuevas = meta === null
    ? actuales.filter((_, j) => j !== i)
    : i < 0 ? [...actuales, { nombre, meta }] : actuales.map((m, j) => (j === i ? { nombre, meta } : m));
  return { metas: nuevas.length ? nuevas.map((m) => `${m.nombre}: ${textoMeta(m.meta)}`).join("; ") : null };
}

/** Número de una meta tecleada (decimal con punto o coma); `null` vacío o inválido. */
export function numeroDeMeta(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// --- Filas extra -------------------------------------------------------------------------------------------------

const campo = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/** Las filas extra de la cobertura, de la lista o del texto viejo «cifra | rótulo | detalle» por línea. */
export function extrasDe(args: Args): FilaExtra[] {
  const v = args.extras;
  if (typeof v === "string") {
    return v.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [cifra = "", rotulo = "", detalle = ""] = l.split("|").map((p) => p.trim());
      return { cifra, rotulo, detalle };
    });
  }
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): FilaExtra[] => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return [];
    const o = x as Record<string, unknown>;
    return [{ cifra: campo(o.cifra), rotulo: campo(o.rotulo), detalle: campo(o.detalle) }];
  });
}

/** Se guardan todas, también la recién agregada y vacía (el motor descarta la que no tiene cifra). */
export function conExtras(filas: readonly FilaExtra[]): Record<string, unknown> {
  return { extras: filas.map((f) => ({ cifra: f.cifra, rotulo: f.rotulo, detalle: f.detalle })) };
}

// --- Públicos ----------------------------------------------------------------------------------------------------

/** Las láminas que llevan el padrón por público: contraste entre bases, fortalezas y cobertura. */
export function llevaPadronPublicos(graficador: string, args: Readonly<Record<string, unknown>>): boolean {
  if (graficador === "p_cobertura" || graficador === "p_fortalezas") return true;
  return graficador === "p_dumbbell" && args.estilo === "resumen" && !esEntreGrupos(args);
}


const fuenteDe = (ref: unknown): string => {
  const r = typeof ref === "string" ? ref : Array.isArray(ref) && typeof ref[0] === "string" ? ref[0] : "";
  const i = r.indexOf("$");
  return i > 0 ? r.slice(0, i).trim() : "";
};

const unicas = (xs: readonly string[]) => [...new Set(xs.filter(Boolean))];

/**
 * Las bases que son públicos de la lámina, en su orden:
 *   - cobertura: todas las del estudio (las que entran las marca `bases`);
 *   - contraste entre bases: las de dos a cuatro declaradas en `bases` (graficos_dumbbell_auto.R) o, sin ellas, las del primer tema
 *     (cada tema declara las mismas, en el mismo orden);
 *   - fortalezas: la base de sus preguntas (un solo público).
 */
export function publicosDe(graficador: string, args: Args, basesEstudio: readonly string[]): string[] {
  if (graficador === "p_cobertura") {
    const elegidas = basesDeCobertura(args);
    return unicas([...basesEstudio, ...elegidas]);
  }
  if (graficador === "p_dumbbell" && Array.isArray(args.bases)) {
    const par = unicas(args.bases.map((b) => (typeof b === "string" ? b.trim() : "")));
    if (par.length >= 2 && par.length <= 4) return par;
  }
  const vars = args.vars;
  if (graficador === "p_fortalezas") return unicas((Array.isArray(vars) ? vars : [vars]).map(fuenteDe)).slice(0, 1);
  if (vars && typeof vars === "object" && !Array.isArray(vars)) {
    const primero = Object.values(vars as Record<string, unknown>)[0];
    return unicas((Array.isArray(primero) ? primero : [primero]).map(fuenteDe));
  }
  return [];
}

/** Las bases elegidas en la cobertura; vacío es todas. */
export function basesDeCobertura(args: Args): string[] {
  const v = args.bases;
  const lista = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;|]/) : [];
  return unicas(lista.map((x) => (typeof x === "string" ? x.trim() : "")));
}

export function publicoIncluido(args: Args, base: string): boolean {
  const elegidas = basesDeCobertura(args);
  return !elegidas.length || elegidas.includes(base);
}

/** Incluir o sacar un público de la cobertura. Con todas incluidas se guarda la lista explícita, en el orden del estudio. */
export function alternarPublico(args: Args, todas: readonly string[], base: string, incluir: boolean): Record<string, unknown> {
  const actuales = todas.filter((b) => publicoIncluido(args, b));
  const nuevas = incluir ? todas.filter((b) => b === base || actuales.includes(b)) : actuales.filter((b) => b !== base);
  return { bases: nuevas };
}

/** ¿Se puede sacar este público? La cobertura necesita al menos uno. */
export function ultimoPublico(args: Args, todas: readonly string[], base: string): boolean {
  const actuales = todas.filter((b) => publicoIncluido(args, b));
  return actuales.length === 1 && actuales[0] === base;
}

// --- Propuesta ---------------------------------------------------------------------------------------------------

export function propuestaDe(propuestas: readonly PadronPropuesto[], base: string): PadronPropuesto | null {
  return propuestas.find((p) => p.base === base) ?? null;
}

/** ¿La propuesta ya está escrita tal cual (padrón confiable y, si la trae y se pide, la meta)? */
export function propuestaEnUso(args: Args, base: string, p: PadronPropuesto, conMetas: boolean): boolean {
  const nombre = nombrePublico(base);
  const pad = padronDe(args, nombre);
  const padOk = p.padron === null || (pad.confiable && pad.valor === p.padron);
  if (!conMetas || p.meta === null || !p.meta_unidad) return padOk;
  const m = metaDe(args, nombre);
  return padOk && !!m && m.valor === p.meta && m.unidad === p.meta_unidad;
}

/** ¿Hay algo que usar de la propuesta para esta base? */
export function propuestaUtil(p: PadronPropuesto | null, conMetas: boolean): p is PadronPropuesto {
  return !!p && (p.padron !== null || (conMetas && p.meta !== null && !!p.meta_unidad));
}

/**
 * El parche que escribe la propuesta de las bases pedidas: el padrón como confiable y, en la cobertura, la meta con su
 * unidad. Una base sin dato no toca lo escrito: la propuesta no borra.
 */
export function conPropuesta(
  args: Args, propuestas: readonly PadronPropuesto[], bases: readonly string[], conMetas: boolean, guardaNoConfiables: boolean,
): Record<string, unknown> {
  let actual: Record<string, unknown> = { ...args };
  const patch: Record<string, unknown> = {};
  for (const base of bases) {
    const p = propuestaDe(propuestas, base);
    if (!p) continue;
    const nombre = nombrePublico(base);
    if (p.padron !== null) {
      const pp = conPadron(actual, nombre, { valor: p.padron, confiable: true }, guardaNoConfiables);
      Object.assign(patch, pp); actual = { ...actual, ...pp };
    }
    if (conMetas && p.meta !== null && p.meta_unidad) {
      const pm = conMeta(actual, nombre, { valor: p.meta, unidad: p.meta_unidad });
      Object.assign(patch, pm); actual = { ...actual, ...pm };
    }
  }
  return patch;
}
