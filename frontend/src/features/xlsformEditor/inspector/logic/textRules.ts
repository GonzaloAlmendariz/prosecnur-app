// =============================================================================
// inspector/logic/textRules.ts — catálogo de reglas de texto en lenguaje humano
// =============================================================================
// Presets de validación de texto (regex) descritos en español ("Debe iniciar
// con…", "Debe tener exactamente N dígitos"). Catálogo puro sin React: la UI
// (TextRuleSuite) y los presets regex del ConstraintBuilder se definen desde
// aquí para no duplicar fuentes.
//
// Decisiones:
//   · Regex portable Java (ODK Collect) / JS (Enketo): clases de caracteres,
//     cuantificadores y alternancia. SIN lookaheads ni banderas.
//   · Las fuentes del catálogo van SIN anclas `^$`; `buildTextRuleConstraint`
//     ancla `^…$` dentro de `regex(., '…')` — consistente con los presets
//     históricos del ConstraintBuilder (email/digits/code anclaban igual).
//   · `matchTextRule` canonicaliza antes de reconocer: strip de anclas
//     externas y `\d` → `[0-9]`, para que constraints importados (`^\d+$`)
//     vuelvan a su receta humana.
//   · `[0-9]{8}` es ambiguo (dni-peru ≡ exactamente-n-digitos con N=8): gana
//     la receta paramétrica genérica por orden del catálogo; la UI puede
//     mostrar "equivale a DNI" cuando N=8.
// =============================================================================

import type { Expr } from "../../logic";
import { serializeExpression } from "../../logic";

export type TextRuleCategory = "longitud" | "contenido" | "formato" | "documentos";

export type TextRuleParamSpec = {
  key: string;
  label: string;
  kind: "int" | "text";
  min?: number;
  placeholder?: string;
};

export type TextRuleParams = Record<string, string | number>;

/** Segmento de la frase humana: texto fijo o hueco de parámetro inline. */
export type TextRulePhrasePart = string | { param: string };

export type TextRuleRecipe = {
  id: string;
  category: TextRuleCategory;
  /** Título humano; sin params usa `defaults`. Ej. "Debe tener exactamente 8 dígitos". */
  title: (p?: TextRuleParams) => string;
  /** Frase para render con inputs inline ("Debe tener exactamente [ 8 ] dígitos"). */
  phrase: TextRulePhrasePart[];
  params: TextRuleParamSpec[];
  defaults: TextRuleParams;
  /** Fuente regex SIN anclas ^$ (ODK regex() valida el valor completo al anclar). */
  buildRegex: (p: TextRuleParams) => string;
  /** constraint_message humano sugerido. */
  buildMessage: (p: TextRuleParams) => string;
  /** Inversa de buildRegex sobre fuente canonicalizada; null si no es esta receta. */
  recognize: (source: string) => TextRuleParams | null;
  /** Para tests y chips de ejemplo en la UI (coherentes con `defaults`). */
  examples: { ok: string[]; bad: string[] };
};

// ----------------------------------------------------------------------------
// Helpers de parámetros (coercen strings de inputs a valores usables)
// ----------------------------------------------------------------------------

function readInt(
  p: TextRuleParams | undefined,
  key: string,
  fallback: number,
  min = 1,
): number {
  const v = p?.[key];
  const n = typeof v === "number" ? Math.floor(v) : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

function readText(p: TextRuleParams | undefined, key: string, fallback: string): string {
  const v = p?.[key];
  const s = v == null ? "" : String(v);
  return s.trim() === "" ? fallback : s;
}

// ----------------------------------------------------------------------------
// Escapado de literales dentro de una regex
// ----------------------------------------------------------------------------

const REGEX_METACHARS = new Set([
  "\\", "^", "$", ".", "|", "?", "*", "+", "(", ")", "[", "]", "{", "}",
]);

/** Escapa un texto literal para incrustarlo en una fuente regex portable. */
export function escapeRegexLiteral(text: string): string {
  return text.replace(/[\\^$.|?*+()[\]{}]/g, (m) => `\\${m}`);
}

/**
 * Inversa de `escapeRegexLiteral`: si `source` es exactamente un literal
 * escapado (sin metacaracteres sueltos), devuelve el texto plano; si no, null.
 */
function unescapeRegexLiteral(source: string): string | null {
  let out = "";
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (ch === "\\") {
      const next = source[i + 1];
      if (next === undefined || !REGEX_METACHARS.has(next)) return null;
      out += next;
      i += 1;
      continue;
    }
    if (REGEX_METACHARS.has(ch)) return null;
    out += ch;
  }
  return out.length > 0 ? out : null;
}

// ----------------------------------------------------------------------------
// Catálogo v1 — el orden del array define la precedencia de `matchTextRule`
// (exactamente-n-digitos va ANTES que dni-peru a propósito).
// ----------------------------------------------------------------------------

const EMAIL_SOURCE = "[^@\\s]+@[^@\\s]+\\.[^@\\s]+";
const LETTERS_SOURCE = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+";
const CODE_SOURCE = "[A-Za-z0-9_-]+";

export const TEXT_RULE_RECIPES: TextRuleRecipe[] = [
  // ── Longitud ──────────────────────────────────────────────────────────────
  {
    id: "exactamente-n-digitos",
    category: "longitud",
    title: (p) => {
      const n = readInt(p, "n", 8);
      return n === 1 ? "Debe tener exactamente 1 dígito" : `Debe tener exactamente ${n} dígitos`;
    },
    phrase: ["Debe tener exactamente ", { param: "n" }, " dígitos"],
    params: [{ key: "n", label: "cantidad de dígitos", kind: "int", min: 1, placeholder: "8" }],
    defaults: { n: 8 },
    buildRegex: (p) => `[0-9]{${readInt(p, "n", 8)}}`,
    buildMessage: (p) => {
      const n = readInt(p, "n", 8);
      return n === 1
        ? "Ingresa exactamente 1 dígito."
        : `Ingresa exactamente ${n} dígitos, sin letras ni espacios.`;
    },
    recognize: (source) => {
      const m = /^\[0-9\]\{(\d+)\}$/.exec(source);
      return m ? { n: Number(m[1]) } : null;
    },
    examples: { ok: ["45678912", "00000001"], bad: ["1234", "123456789", "1234567a"] },
  },
  {
    id: "entre-n-y-m-caracteres",
    category: "longitud",
    title: (p) =>
      `Debe tener entre ${readInt(p, "min", 2)} y ${Math.max(readInt(p, "min", 2), readInt(p, "max", 10))} caracteres`,
    phrase: ["Debe tener entre ", { param: "min" }, " y ", { param: "max" }, " caracteres"],
    params: [
      { key: "min", label: "mínimo de caracteres", kind: "int", min: 1, placeholder: "2" },
      { key: "max", label: "máximo de caracteres", kind: "int", min: 1, placeholder: "10" },
    ],
    defaults: { min: 2, max: 10 },
    buildRegex: (p) => {
      const min = readInt(p, "min", 2);
      const max = Math.max(min, readInt(p, "max", 10));
      return `.{${min},${max}}`;
    },
    buildMessage: (p) => {
      const min = readInt(p, "min", 2);
      const max = Math.max(min, readInt(p, "max", 10));
      return `Ingresa entre ${min} y ${max} caracteres.`;
    },
    recognize: (source) => {
      const m = /^\.\{(\d+),(\d+)\}$/.exec(source);
      return m ? { min: Number(m[1]), max: Number(m[2]) } : null;
    },
    examples: { ok: ["ab", "hola mundo"], bad: ["a", "abcdefghijk"] },
  },
  // ── Contenido ─────────────────────────────────────────────────────────────
  {
    id: "solo-numeros",
    category: "contenido",
    title: () => "Solo números",
    phrase: ["Solo números, sin letras ni símbolos"],
    params: [],
    defaults: {},
    buildRegex: () => "[0-9]+",
    buildMessage: () => "Ingresa solo números, sin letras ni símbolos.",
    recognize: (source) => (source === "[0-9]+" ? {} : null),
    examples: { ok: ["123", "0"], bad: ["12a", "1 2", "-5"] },
  },
  {
    id: "solo-letras",
    category: "contenido",
    title: () => "Solo letras y espacios",
    phrase: ["Solo letras y espacios, sin números"],
    params: [],
    defaults: {},
    buildRegex: () => LETTERS_SOURCE,
    buildMessage: () => "Ingresa solo letras, sin números ni símbolos.",
    recognize: (source) => (source === LETTERS_SOURCE ? {} : null),
    examples: { ok: ["María José", "ñandú"], bad: ["Juan23", "hola_mundo"] },
  },
  {
    id: "sin-numeros",
    category: "contenido",
    title: () => "Sin números",
    phrase: ["No debe incluir números"],
    params: [],
    defaults: {},
    buildRegex: () => "[^0-9]*",
    buildMessage: () => "La respuesta no debe incluir números.",
    recognize: (source) => (source === "[^0-9]*" ? {} : null),
    examples: { ok: ["hola!", "sin cifras"], bad: ["tel 999", "4"] },
  },
  // ── Formato ───────────────────────────────────────────────────────────────
  {
    id: "empieza-con",
    category: "formato",
    title: (p) => `Debe iniciar con “${readText(p, "texto", "PE-")}”`,
    phrase: ["Debe iniciar con ", { param: "texto" }],
    params: [{ key: "texto", label: "texto inicial", kind: "text", placeholder: "PE-" }],
    defaults: { texto: "PE-" },
    buildRegex: (p) => `${escapeRegexLiteral(readText(p, "texto", "PE-"))}.*`,
    buildMessage: (p) => `La respuesta debe iniciar con “${readText(p, "texto", "PE-")}”.`,
    recognize: (source) => {
      if (!source.endsWith(".*") || source.length <= 2) return null;
      const texto = unescapeRegexLiteral(source.slice(0, -2));
      return texto ? { texto } : null;
    },
    examples: { ok: ["PE-001", "PE-A"], bad: ["001-PE", "pe-001"] },
  },
  {
    id: "termina-con",
    category: "formato",
    title: (p) => `Debe terminar en “${readText(p, "texto", ".pdf")}”`,
    phrase: ["Debe terminar en ", { param: "texto" }],
    params: [{ key: "texto", label: "texto final", kind: "text", placeholder: ".pdf" }],
    defaults: { texto: ".pdf" },
    buildRegex: (p) => `.*${escapeRegexLiteral(readText(p, "texto", ".pdf"))}`,
    buildMessage: (p) => `La respuesta debe terminar en “${readText(p, "texto", ".pdf")}”.`,
    recognize: (source) => {
      if (!source.startsWith(".*") || source.length <= 2) return null;
      const texto = unescapeRegexLiteral(source.slice(2));
      return texto ? { texto } : null;
    },
    examples: { ok: ["informe.pdf", "acta final.pdf"], bad: ["informe.docx", "pdf"] },
  },
  {
    id: "correo-electronico",
    category: "formato",
    title: () => "Correo electrónico válido",
    phrase: ["Correo electrónico (nombre@dominio.org)"],
    params: [],
    defaults: {},
    buildRegex: () => EMAIL_SOURCE,
    buildMessage: () => "Ingresa un correo electrónico válido.",
    recognize: (source) => (source === EMAIL_SOURCE ? {} : null),
    examples: { ok: ["ana@pucp.edu.pe", "equipo@ong.org"], bad: ["ana@", "ana correo@x.com", "ana@x"] },
  },
  {
    id: "enlace-web",
    category: "formato",
    title: () => "Enlace web (http/https)",
    phrase: ["Enlace web que inicia con http:// o https://"],
    params: [],
    defaults: {},
    buildRegex: () => "https?://.+",
    buildMessage: () => "Ingresa un enlace web válido (http:// o https://).",
    recognize: (source) => (source === "https?://.+" ? {} : null),
    examples: { ok: ["https://pucp.edu.pe", "http://ong.org/informe"], bad: ["www.pucp.edu.pe", "ftp://x"] },
  },
  {
    id: "codigo-sin-espacios",
    category: "formato",
    title: () => "Código sin espacios",
    phrase: ["Código sin espacios (letras, números, - y _)"],
    params: [],
    defaults: {},
    buildRegex: () => CODE_SOURCE,
    buildMessage: () => "Ingresa un código sin espacios.",
    recognize: (source) => (source === CODE_SOURCE ? {} : null),
    examples: { ok: ["ABC_123", "zona-4"], bad: ["cod 12", "año1"] },
  },
  {
    id: "codigo-alfanumerico-n",
    category: "formato",
    title: (p) => {
      const n = readInt(p, "n", 6);
      return n === 1 ? "Código de 1 carácter" : `Código de ${n} caracteres`;
    },
    phrase: ["Código de ", { param: "n" }, " caracteres"],
    params: [{ key: "n", label: "cantidad de caracteres", kind: "int", min: 1, placeholder: "6" }],
    defaults: { n: 6 },
    buildRegex: (p) => `[A-Za-z0-9_-]{${readInt(p, "n", 6)}}`,
    buildMessage: (p) =>
      `Ingresa un código de ${readInt(p, "n", 6)} caracteres (letras, números, guion o guion bajo).`,
    recognize: (source) => {
      const m = /^\[A-Za-z0-9_-\]\{(\d+)\}$/.exec(source);
      return m ? { n: Number(m[1]) } : null;
    },
    examples: { ok: ["AB12_9", "zona-1"], bad: ["AB1", "AB12345", "AB 12!"] },
  },
  // ── Documentos Perú ───────────────────────────────────────────────────────
  {
    id: "dni-peru",
    category: "documentos",
    title: () => "DNI peruano (8 dígitos)",
    phrase: ["DNI peruano: exactamente 8 dígitos"],
    params: [],
    defaults: {},
    buildRegex: () => "[0-9]{8}",
    buildMessage: () => "Ingresa un DNI válido de 8 dígitos.",
    recognize: (source) => (source === "[0-9]{8}" ? {} : null),
    examples: { ok: ["45678912"], bad: ["4567891", "456789123", "4567891a"] },
  },
  {
    id: "celular-peru",
    category: "documentos",
    title: () => "Celular peruano (9 dígitos)",
    phrase: ["Celular peruano: 9 dígitos, inicia con 9"],
    params: [],
    defaults: {},
    buildRegex: () => "9[0-9]{8}",
    buildMessage: () => "Ingresa un celular de 9 dígitos que inicie con 9.",
    recognize: (source) => (source === "9[0-9]{8}" ? {} : null),
    examples: { ok: ["987654321"], bad: ["87654321", "9876543210", "98765432a"] },
  },
];

/** Orden y etiquetas humanas de las categorías para la galería. */
export const TEXT_RULE_CATEGORIES: Array<{ id: TextRuleCategory; label: string }> = [
  { id: "longitud", label: "Longitud" },
  { id: "contenido", label: "Contenido" },
  { id: "formato", label: "Formato" },
  { id: "documentos", label: "Documentos Perú" },
];

export function textRuleById(id: string): TextRuleRecipe | undefined {
  return TEXT_RULE_RECIPES.find((recipe) => recipe.id === id);
}

/** ¿Los params alcanzan para aplicar la receta? (gate del botón Aplicar). */
export function textRuleParamsValid(recipe: TextRuleRecipe, params: TextRuleParams): boolean {
  return recipe.params.every((spec) => {
    const v = params[spec.key];
    if (spec.kind === "int") {
      const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
      return Number.isFinite(n) && n >= (spec.min ?? 1);
    }
    return String(v ?? "").trim().length > 0;
  });
}

// ----------------------------------------------------------------------------
// Reconocimiento sobre el AST + construcción de la expresión ODK
// ----------------------------------------------------------------------------

/**
 * Canonicaliza una fuente regex antes de probar cada `recognize`:
 * strip de anclas externas `^…$` y `\d` → `[0-9]` (clase equivalente y
 * portable). El reemplazo es naive respecto a `\\d` (backslash literal + d),
 * caso inexistente en el corpus auditado.
 */
function canonicalizeRegexSource(value: string): string {
  let s = value.trim();
  if (s.startsWith("^")) s = s.slice(1);
  if (s.endsWith("$") && !s.endsWith("\\$")) s = s.slice(0, -1);
  return s.replace(/\\d/g, "[0-9]");
}

/**
 * Reconoce `regex(., '…')` cuya fuente corresponde a una receta del catálogo.
 * Devuelve la receta + params equivalentes, o null (→ el builder cae a la
 * caja técnica como hoy). Ante fuentes ambiguas gana la primera receta en
 * orden de catálogo (la paramétrica genérica antes que dni-peru).
 */
export function matchTextRule(
  expr: Expr | null,
): { recipe: TextRuleRecipe; params: TextRuleParams } | null {
  if (!expr || expr.kind !== "call" || expr.name !== "regex" || expr.args.length !== 2) {
    return null;
  }
  const target = expr.args[0]!;
  const pattern = expr.args[1]!;
  if (target.kind !== "current") return null;
  if (pattern.kind !== "literal" || typeof pattern.value !== "string") return null;
  const source = canonicalizeRegexSource(pattern.value);
  for (const recipe of TEXT_RULE_RECIPES) {
    const params = recipe.recognize(source);
    if (params) return { recipe, params };
  }
  return null;
}

/**
 * Expresión ODK lista para la columna constraint: `regex(., '^…$')`.
 * Ancla `^…$` dentro del patrón — mismo criterio que los presets históricos
 * del ConstraintBuilder. Serializada vía el AST para escapado consistente.
 */
export function buildTextRuleConstraint(recipe: TextRuleRecipe, params: TextRuleParams): string {
  const source = recipe.buildRegex(params);
  return serializeExpression({
    kind: "call",
    name: "regex",
    args: [{ kind: "current" }, { kind: "literal", value: `^${source}$` }],
  });
}

/**
 * Compila la fuente para el probador en vivo del navegador. Ancla con un
 * grupo no-capturante para imitar el match completo de ODK `regex()`.
 * La validación final corre en el dispositivo (Java/JS según el cliente).
 */
export function compileForJs(source: string): RegExp | null {
  try {
    return new RegExp(`^(?:${source})$`, "u");
  } catch {
    return null;
  }
}
