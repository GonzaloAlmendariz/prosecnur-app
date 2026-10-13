// Modelo puro de «Agrupar categorías» (ítem 1f). El componente guarda un
// borrador editable y lo convierte en la spec del backend al guardar. La
// clasificación local replica el orden de `api/R/codificacion_agrupar.R` para
// que la tabla diga a qué categoría cae cada código antes de guardar.

import type {
  AgrupacionCategoria,
  AgrupacionCodigoOriginal,
  AgrupacionResponse,
  AgrupacionSpec,
} from "../../api/codificacion";

export type CategoriaBorrador = {
  /** Identidad local estable (la del código cambia al editar). */
  id: string;
  codigo: string;
  etiqueta: string;
  codigos: string[];
  /** Texto del input: vacío significa sin límite. */
  rangoMin: string;
  rangoMax: string;
  otrosTextos: string[];
  otrosNumerico: boolean;
  otrosResto: boolean;
  resto: boolean;
};

export type BorradorAgrupacion = {
  target: string;
  textCol: string | null;
  codigoOtro: string | null;
  categorias: CategoriaBorrador[];
  /** Contador para ids locales. */
  siguienteId: number;
};

export type AccionBorrador =
  | { tipo: "reemplazar"; borrador: BorradorAgrupacion }
  | { tipo: "target"; valor: string }
  | { tipo: "codigoOtro"; valor: string | null }
  | { tipo: "agregar" }
  | { tipo: "quitar"; id: string }
  | { tipo: "mover"; id: string; delta: -1 | 1 }
  | { tipo: "editar"; id: string; cambios: Partial<Pick<CategoriaBorrador, "codigo" | "etiqueta" | "rangoMin" | "rangoMax" | "otrosNumerico">> }
  | { tipo: "resto"; id: string; activo: boolean }
  | { tipo: "otrosResto"; id: string; activo: boolean }
  | { tipo: "asignarCodigo"; codigo: string; id: string | null }
  | { tipo: "asignarTexto"; texto: string; id: string | null };

const RE_TARGET = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const RE_CODIGO = /^[A-Za-z0-9_.-]+$/;

/** Misma normalización que `.normalize_text` del backend para comparar textos. */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function categoriaVacia(id: string, codigo: string): CategoriaBorrador {
  return {
    id, codigo, etiqueta: "", codigos: [], rangoMin: "", rangoMax: "",
    otrosTextos: [], otrosNumerico: false, otrosResto: false, resto: false,
  };
}

/** Siguiente código libre: el mayor entero usado más uno. */
export function siguienteCodigo(categorias: CategoriaBorrador[]): string {
  const usados = categorias.map((c) => Number(c.codigo)).filter((n) => Number.isInteger(n));
  return String(usados.length ? Math.max(...usados) + 1 : 1);
}

/** El código de «Otro» por defecto: el que se rotula como tal. */
export function sugerirCodigoOtro(codigos: AgrupacionCodigoOriginal[]): string | null {
  const hit = codigos.find((c) => /^otr[oa]s?\b/i.test(normalizarTexto(c.etiqueta)));
  return hit ? hit.codigo : null;
}

function numATexto(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

export function borradorDesdeRespuesta(r: AgrupacionResponse): BorradorAgrupacion {
  const spec = r.spec;
  const categorias = (spec?.categorias ?? []).map((c, i) => ({
    id: `c${i + 1}`,
    codigo: c.codigo,
    etiqueta: c.etiqueta,
    codigos: [...c.codigos],
    rangoMin: numATexto(c.rango?.min),
    rangoMax: numATexto(c.rango?.max),
    otrosTextos: [...c.otros_textos],
    otrosNumerico: c.otros_numerico,
    otrosResto: c.otros_resto,
    resto: c.resto,
  }));
  return {
    target: spec?.target || r.target_sugerido,
    textCol: spec?.text_col ?? r.text_col_sugerida,
    codigoOtro: spec?.codigo_otro ?? (r.text_col_sugerida ? sugerirCodigoOtro(r.codigos) : null),
    categorias,
    siguienteId: categorias.length + 1,
  };
}

function mapCategoria(b: BorradorAgrupacion, id: string, f: (c: CategoriaBorrador) => CategoriaBorrador): BorradorAgrupacion {
  return { ...b, categorias: b.categorias.map((c) => (c.id === id ? f(c) : c)) };
}

export function reducirBorrador(b: BorradorAgrupacion, a: AccionBorrador): BorradorAgrupacion {
  switch (a.tipo) {
    case "reemplazar":
      return a.borrador;
    case "target":
      return { ...b, target: a.valor };
    case "codigoOtro":
      return { ...b, codigoOtro: a.valor };
    case "agregar": {
      const id = `c${b.siguienteId}`;
      return {
        ...b,
        siguienteId: b.siguienteId + 1,
        categorias: [...b.categorias, categoriaVacia(id, siguienteCodigo(b.categorias))],
      };
    }
    case "quitar":
      return { ...b, categorias: b.categorias.filter((c) => c.id !== a.id) };
    case "mover": {
      const i = b.categorias.findIndex((c) => c.id === a.id);
      const j = i + a.delta;
      if (i < 0 || j < 0 || j >= b.categorias.length) return b;
      const next = [...b.categorias];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...b, categorias: next };
    }
    case "editar":
      return mapCategoria(b, a.id, (c) => ({ ...c, ...a.cambios }));
    case "resto":
      // Sólo una categoría recoge el resto de códigos.
      return {
        ...b,
        categorias: b.categorias.map((c) => ({ ...c, resto: c.id === a.id ? a.activo : a.activo ? false : c.resto })),
      };
    case "otrosResto":
      return {
        ...b,
        categorias: b.categorias.map((c) => ({
          ...c, otrosResto: c.id === a.id ? a.activo : a.activo ? false : c.otrosResto,
        })),
      };
    case "asignarCodigo":
      // Un código original vive en una sola categoría.
      return {
        ...b,
        categorias: b.categorias.map((c) => {
          const sin = c.codigos.filter((x) => x !== a.codigo);
          return c.id === a.id ? { ...c, codigos: [...sin, a.codigo] } : { ...c, codigos: sin };
        }),
      };
    case "asignarTexto": {
      const norm = normalizarTexto(a.texto);
      return {
        ...b,
        categorias: b.categorias.map((c) => {
          const sin = c.otrosTextos.filter((x) => normalizarTexto(x) !== norm);
          return c.id === a.id ? { ...c, otrosTextos: [...sin, a.texto] } : { ...c, otrosTextos: sin };
        }),
      };
    }
  }
}

function textoANumero(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function rangoDe(c: CategoriaBorrador): { min: number | null; max: number | null } | null {
  const min = textoANumero(c.rangoMin);
  const max = textoANumero(c.rangoMax);
  return min == null && max == null ? null : { min, max };
}

/** Categoría (id) a la que el usuario asignó un código o texto explícitamente. */
export function categoriaDeCodigo(b: BorradorAgrupacion, codigo: string): string | null {
  return b.categorias.find((c) => c.codigos.includes(codigo))?.id ?? null;
}

export function categoriaDeTexto(b: BorradorAgrupacion, texto: string): string | null {
  const norm = normalizarTexto(texto);
  return b.categorias.find((c) => c.otrosTextos.some((x) => normalizarTexto(x) === norm))?.id ?? null;
}

export type Destino = { id: string; via: "codigo" | "rango" | "resto" } | null;

function rangoAplica(r: { min: number | null; max: number | null } | null, v: string, codigoOtro: string | null): boolean {
  if (!r) return false;
  const n = Number(v);
  if (!v.trim() || !Number.isFinite(n)) return false;
  if (codigoOtro != null && v === codigoOtro) return false;
  const abierto = r.min == null || r.max == null;
  if (abierto && n >= 80 && n < 100) return false;
  return n >= (r.min ?? -Infinity) && n <= (r.max ?? Infinity);
}

/** Dónde cae un código original (sin texto de «Otro»), en el orden del motor. */
export function destinoDeCodigo(b: BorradorAgrupacion, codigo: string): Destino {
  for (const c of b.categorias) {
    if (c.codigos.includes(codigo)) return { id: c.id, via: "codigo" };
    if (rangoAplica(rangoDe(c), codigo, b.codigoOtro)) return { id: c.id, via: "rango" };
  }
  const resto = b.categorias.find((c) => c.resto);
  return resto ? { id: resto.id, via: "resto" } : null;
}

/** Dónde cae un texto escrito en «Otro». */
export function destinoDeTexto(b: BorradorAgrupacion, texto: string): { id: string; via: "texto" | "rango" | "resto" } | null {
  const id = categoriaDeTexto(b, texto);
  if (id) return { id, via: "texto" };
  const t = texto.trim();
  if (/^-?[0-9]+$/.test(t)) {
    const n = Number(t);
    for (const c of b.categorias) {
      const r = rangoDe(c);
      if (c.otrosNumerico && r && n >= (r.min ?? -Infinity) && n <= (r.max ?? Infinity)) return { id: c.id, via: "rango" };
    }
  }
  const resto = b.categorias.find((c) => c.otrosResto);
  return resto ? { id: resto.id, via: "resto" } : null;
}

/** Problemas que el backend rechazaría. Vacío significa que se puede guardar. */
export function validarBorrador(b: BorradorAgrupacion, parent: string, ocupados: string[] = []): string[] {
  const out: string[] = [];
  const target = b.target.trim();
  if (!target) out.push("Escribe el nombre de la variable nueva.");
  else if (!RE_TARGET.test(target)) out.push(`«${target}» no es un nombre válido. Usa letras, números y guion bajo, sin espacios.`);
  else if (target.toLowerCase() === parent.toLowerCase()) out.push("La variable nueva no puede llamarse igual que la original.");
  else if (ocupados.some((o) => o.toLowerCase() === target.toLowerCase())) out.push(`El nombre «${target}» ya lo usa otra codificación.`);

  if (b.categorias.length === 0) out.push("Agrega al menos una categoría.");
  const vistos = new Set<string>();
  for (const c of b.categorias) {
    const nombre = c.etiqueta.trim() || c.codigo.trim() || "una categoría";
    const cod = c.codigo.trim();
    if (!cod) out.push(`Falta el código de «${nombre}».`);
    else if (!RE_CODIGO.test(cod)) out.push(`El código «${cod}» no puede llevar espacios ni símbolos.`);
    else if (vistos.has(cod)) out.push(`El código «${cod}» se repite en dos categorías.`);
    vistos.add(cod);
    if (!c.etiqueta.trim()) out.push(`Falta la etiqueta de la categoría ${cod || "sin código"}.`);
    const minTxt = c.rangoMin.trim();
    const maxTxt = c.rangoMax.trim();
    if ((minTxt && textoANumero(minTxt) == null) || (maxTxt && textoANumero(maxTxt) == null)) {
      out.push(`El rango de «${nombre}» debe ser numérico.`);
    }
    const r = rangoDe(c);
    if (r && r.min != null && r.max != null && r.min > r.max) out.push(`El rango de «${nombre}» tiene el mínimo mayor que el máximo.`);
    if (c.otrosNumerico && !r) out.push(`«${nombre}» clasifica años escritos en «Otro» pero no tiene rango.`);
  }
  const usaOtro = b.categorias.some((c) => c.otrosTextos.length > 0 || c.otrosNumerico || c.otrosResto);
  if (usaOtro && (!b.textCol || !b.codigoOtro)) {
    out.push("Para clasificar los textos de «Otro» elige cuál es el código de «Otro».");
  }
  return out;
}

export function construirSpec(b: BorradorAgrupacion, parent: string): AgrupacionSpec {
  const categorias: AgrupacionCategoria[] = b.categorias.map((c) => ({
    codigo: c.codigo.trim(),
    etiqueta: c.etiqueta.trim(),
    codigos: [...c.codigos],
    rango: rangoDe(c),
    otros_textos: b.textCol ? [...c.otrosTextos] : [],
    otros_numerico: b.textCol ? c.otrosNumerico : false,
    otros_resto: b.textCol ? c.otrosResto : false,
    resto: c.resto,
  }));
  return {
    parent,
    target: b.target.trim(),
    text_col: b.textCol,
    codigo_otro: b.codigoOtro,
    categorias,
  };
}
