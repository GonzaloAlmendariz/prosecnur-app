// Lectura de un patrón regex como lo que ACEPTA, en una frase nominal («8 dígitos», «un número de 18 a 99»,
// «el formato 99/9999»). Se interpreta el patrón, no se compara con patrones escritos de antemano: un analizador
// pequeño (literales, clases, grupos con |, cuantificadores) que, si el lenguaje es finito, lo enumera y reconoce
// rangos numéricos; si no, describe la secuencia. Lo que no entra en ese subconjunto devuelve null (técnica).

import { cantidad, t, v, type Frase } from "./frase";

type Atomo =
  | { tipo: "car"; c: string }
  | { tipo: "clase"; chars: string[]; nombre: NombreClase | null; mayus: boolean; minus: boolean; acentos: boolean; negada: boolean }
  | { tipo: "grupo"; alternativas: Nodo[][] };
type Nodo = { atomo: Atomo; min: number; max: number };

type NombreClase = "dígito" | "letra" | "espacio" | "letra o espacio" | "letra o dígito";
const PLURAL: Record<NombreClase, string> = { dígito: "dígitos", letra: "letras", espacio: "espacios", "letra o espacio": "letras o espacios", "letra o dígito": "letras o dígitos" };
/** Plural para «no acepta …» / «sin …»: los dígitos se nombran como números. */
const PLURAL_LIBRE: Record<NombreClase, string> = { ...PLURAL, dígito: "números" };
const ESPACIOS = [" ", "\t"];

const LIMITE = 20000;
const DIGITOS = "0123456789".split("");
const LETRAS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

class Lector {
  private i = 0;
  constructor(private readonly s: string) {}

  leer(): Nodo[][] {
    const alts = this.alternativas();
    if (this.i < this.s.length) throw new Error("sobra");
    return alts;
  }

  private alternativas(): Nodo[][] {
    const alts: Nodo[][] = [this.secuencia()];
    while (this.s[this.i] === "|") {
      this.i++;
      alts.push(this.secuencia());
    }
    return alts;
  }

  private secuencia(): Nodo[] {
    const out: Nodo[] = [];
    while (this.i < this.s.length && this.s[this.i] !== "|" && this.s[this.i] !== ")") {
      const atomo = this.atomo();
      if (!atomo) continue;
      const [min, max] = this.cuantificador();
      out.push({ atomo, min, max });
    }
    return out;
  }

  private atomo(): Atomo | null {
    const c = this.s[this.i]!;
    if (c === "^" || c === "$") {
      this.i++;
      return null;
    }
    if (c === "(") {
      this.i++;
      if (this.s.startsWith("?:", this.i)) this.i += 2;
      const alternativas = this.alternativas();
      if (this.s[this.i] !== ")") throw new Error("grupo");
      this.i++;
      return { tipo: "grupo", alternativas };
    }
    if (c === "[") return this.clase();
    if (c === "\\") {
      const n = this.s[this.i + 1] ?? "";
      this.i += 2;
      if (n === "d" || n === "s" || n === "w") return claseDe(escapeDeClase(n), false);
      if (/[SWbB]/.test(n) || !n) throw new Error("escape");
      return { tipo: "car", c: n };
    }
    if (c === "." || c === "*" || c === "+" || c === "?" || c === "{") throw new Error("comodín");
    this.i++;
    return { tipo: "car", c };
  }

  private clase(): Atomo {
    this.i++;
    const negada = this.s[this.i] === "^";
    if (negada) this.i++;
    const chars: string[] = [];
    while (this.i < this.s.length && this.s[this.i] !== "]") {
      const c = this.s[this.i]!;
      if (c === "\\") {
        const n = this.s[this.i + 1] ?? "";
        this.i += 2;
        if (n === "d" || n === "s" || n === "w") chars.push(...escapeDeClase(n));
        else if (/[SW]/.test(n)) throw new Error("escape");
        else chars.push(n);
        continue;
      }
      if (this.s[this.i + 1] === "-" && this.s[this.i + 2] && this.s[this.i + 2] !== "]") {
        const fin = this.s[this.i + 2]!;
        for (let k = c.charCodeAt(0); k <= fin.charCodeAt(0); k++) chars.push(String.fromCharCode(k));
        this.i += 3;
        continue;
      }
      chars.push(c);
      this.i++;
    }
    if (this.s[this.i] !== "]") throw new Error("clase");
    this.i++;
    return claseDe(chars, negada);
  }

  private cuantificador(): [number, number] {
    const c = this.s[this.i];
    if (c === "?") {
      this.i++;
      return [0, 1];
    }
    if (c === "+" || c === "*") {
      this.i++;
      return [c === "+" ? 1 : 0, Infinity];
    }
    if (c === "{") {
      const m = this.s.slice(this.i).match(/^\{(\d+)(,(\d*))?\}/);
      if (!m) throw new Error("llaves");
      this.i += m[0].length;
      const min = Number(m[1]);
      return [min, m[2] ? (m[3] ? Number(m[3]) : Infinity) : min];
    }
    return [1, 1];
  }
}

function escapeDeClase(n: string): string[] {
  if (n === "d") return DIGITOS;
  if (n === "s") return ESPACIOS;
  return [...LETRAS, ...DIGITOS, "_"];
}

/** Nombre de una clase por lo que contiene: dígitos, letras (con tildes), espacios, o una mezcla legible. */
function claseDe(chars: string[], negada: boolean): Atomo {
  const unicos = [...new Set(chars)];
  const digitos = unicos.filter((c) => /\d/.test(c));
  const letras = unicos.filter((c) => /\p{L}/u.test(c));
  const espacios = unicos.filter((c) => /\s/.test(c) || c === "\t");
  const resto = unicos.filter((c) => !digitos.includes(c) && !letras.includes(c) && !espacios.includes(c) && c !== "_");
  const todosDigitos = digitos.length === 10;
  const todasLetras = LETRAS.slice(0, 26).every((l) => letras.includes(l) || letras.includes(l.toUpperCase()));
  let nombre: NombreClase | null = null;
  if (!resto.length && !(unicos.includes("_") && !(todasLetras && todosDigitos))) {
    if (todosDigitos && !letras.length && !espacios.length) nombre = "dígito";
    else if (todasLetras && !digitos.length) nombre = espacios.length ? "letra o espacio" : "letra";
    else if (todasLetras && todosDigitos && !espacios.length) nombre = "letra o dígito";
    else if (espacios.length && !letras.length && !digitos.length) nombre = "espacio";
  }
  const mayus = letras.length > 0 && letras.every((c) => c === c.toUpperCase() && c !== c.toLowerCase());
  const minus = letras.length > 0 && letras.every((c) => c === c.toLowerCase() && c !== c.toUpperCase());
  // Letras fuera del alfabeto básico: «á», «ñ», «ü». Se nombran («con tildes») porque cambian lo que se acepta.
  const acentos = letras.some((c) => !LETRAS.includes(c));
  return { tipo: "clase", chars: unicos, nombre, mayus, minus, acentos, negada };
}

/** Todas las cadenas que acepta, o null si son infinitas o demasiadas. */
function enumerar(alts: Nodo[][]): string[] | null {
  const out: string[] = [];
  for (const sec of alts) {
    let parciales = [""];
    for (const n of sec) {
      if (!Number.isFinite(n.max)) return null;
      if (n.atomo.tipo === "clase" && n.atomo.negada) return null;
      const base = n.atomo.tipo === "car" ? [n.atomo.c] : n.atomo.tipo === "clase" ? n.atomo.chars : enumerar(n.atomo.alternativas);
      if (!base) return null;
      // El tope se mira ANTES de multiplicar: construir y luego medir agota la memoria ([A-Z]{3}-\d{3,4}).
      let total = 0;
      for (let k = n.min; k <= n.max; k++) {
        total += base.length ** k;
        if (total > LIMITE) return null;
      }
      if (parciales.length * total > LIMITE) return null;
      const reps: string[] = [];
      for (let k = n.min; k <= n.max; k++) {
        let r = [""];
        for (let j = 0; j < k; j++) r = r.flatMap((x) => base.map((b) => x + b));
        reps.push(...r);
      }
      parciales = parciales.flatMap((p) => reps.map((r) => p + r));
    }
    out.push(...parciales);
    if (out.length > LIMITE) return null;
  }
  return [...new Set(out)];
}

function rangoNumerico(cadenas: string[]): [number, number] | null {
  if (cadenas.length < 3 || !cadenas.every((c) => /^(0|[1-9]\d*)$/.test(c))) return null;
  const nums = cadenas.map(Number).sort((a, b) => a - b);
  for (let k = 1; k < nums.length; k++) if (nums[k] !== nums[k - 1]! + 1) return null;
  return [nums[0]!, nums[nums.length - 1]!];
}

/** Rango de horas HH:MM sin huecos: «de 00:00 a 23:59». */
function rangoHoras(cadenas: string[]): [string, string] | null {
  if (cadenas.length < 2 || !cadenas.every((c) => /^([01]\d|2[0-3]):[0-5]\d$/.test(c))) return null;
  const mins = cadenas.map((c) => Number(c.slice(0, 2)) * 60 + Number(c.slice(3))).sort((a, b) => a - b);
  for (let k = 1; k < mins.length; k++) if (mins[k] !== mins[k - 1]! + 1) return null;
  const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return [hora(mins[0]!), hora(mins[mins.length - 1]!)];
}

/** Singular y plural de una clase con nombre: «letra mayúscula», «letras con tildes y espacios». */
function nombres(a: Extract<Atomo, { tipo: "clase" }>): [string, string, boolean] {
  const nombre = a.nombre!;
  if (nombre === "letra") {
    if (a.mayus) return ["letra mayúscula", "letras mayúsculas", true];
    if (a.minus) return ["letra minúscula", "letras minúsculas", true];
    if (a.acentos) return ["letra", "letras con tildes", true];
    return ["letra", "letras", true];
  }
  if (nombre === "letra o espacio" && a.acentos) return ["letra o espacio", "letras con tildes y espacios", true];
  return [nombre, PLURAL[nombre], nombre !== "dígito" && nombre !== "espacio"];
}

/** Cuántas veces: «8», «de 2 a 4», «una o más». */
function veces(n: Nodo, singular: string, plural: string, femenino = false): Frase {
  if (n.min === n.max) return [cantidad(String(n.min), singular, plural)];
  if (!Number.isFinite(n.max)) {
    const uno = femenino ? "una o más" : "uno o más";
    return [v(`${n.min === 0 ? "cualquier cantidad de" : n.min === 1 ? uno : `${n.min} o más`} ${plural}`)];
  }
  return [v(`de ${n.min} a ${n.max} ${plural}`)];
}

/** «9 dígitos que empiezan con 9», «11 dígitos que empiezan con 10 o 20»: un prefijo fijo y dígitos. */
function prefijoDigitos(sec: Nodo[]): Frase | null {
  if (sec.length < 2) return null;
  const ult = sec[sec.length - 1]!;
  if (ult.atomo.tipo !== "clase" || ult.atomo.nombre !== "dígito" || ult.atomo.negada || ult.min !== ult.max) return null;
  const pref = enumerar([sec.slice(0, -1)]);
  if (!pref || !pref.length || pref.length > 4 || !pref.every((p) => /^\d+$/.test(p) && p.length === pref[0]!.length)) return null;
  const total = pref[0]!.length + ult.min;
  return [v(`${total} dígitos`), t("que empiezan con"), ...pref.flatMap((x, i) => [...(i ? [t(i === pref.length - 1 ? "o" : ",")] : []), v(x)])];
}

/** «2 letras mayúsculas y 4 dígitos»: partes de largo fijo, todas clases con nombre. */
function porPartes(sec: Nodo[]): Frase | null {
  const partes: { a: Extract<Atomo, { tipo: "clase" }>; n: number }[] = [];
  for (const n of sec) {
    const a = n.atomo;
    if (a.tipo !== "clase" || !a.nombre || a.negada || n.min !== n.max || !Number.isFinite(n.max)) return null;
    const previa = partes[partes.length - 1];
    if (previa && previa.a.chars.join("") === a.chars.join("")) previa.n += n.min;
    else partes.push({ a, n: n.min });
  }
  if (partes.length < 2) return null;
  return enumerarFrases(
    partes.map(({ a, n }) => {
      const [singular, plural] = nombres(a);
      return [cantidad(String(n), singular, plural)];
    }),
  );
}

function enumerarFrases(frases: Frase[]): Frase {
  return frases.flatMap((f, i) => [...(i ? [t(i === frases.length - 1 ? "y" : ",")] : []), ...f]);
}

/** Ejemplo de la forma: [0-9]{2}/[0-9]{4} → «99/9999». null si hay repeticiones abiertas o grupos complejos. */
function ejemplo(sec: Nodo[]): string[] | null {
  let out = [""];
  for (const n of sec) {
    // Repeticiones fijas o de dos largos ({3,4} → «999» o «9999»); más variación ya no es un ejemplo.
    if (!Number.isFinite(n.max) || n.max - n.min > 1) return null;
    let trozo: string[];
    if (n.atomo.tipo === "car") trozo = [n.atomo.c];
    else if (n.atomo.tipo === "clase") {
      if (n.atomo.negada) return null;
      // Una clase de solo mayúsculas se ilustra en mayúscula: [A-Z]{2} → «AA». Un tramo de dígitos ([0-5]) es «9».
      const soloDigitos = n.atomo.chars.every((c) => DIGITOS.includes(c));
      trozo = [n.atomo.chars.length === 1 ? n.atomo.chars[0]! : n.atomo.nombre === "dígito" || soloDigitos ? "9" : n.atomo.nombre === "letra" ? (n.atomo.mayus ? "A" : "a") : ""];
    }
    else {
      if (n.atomo.alternativas.length > 3) return null;
      const subs = n.atomo.alternativas.map(ejemplo);
      if (subs.some((s) => !s)) return null;
      trozo = [...new Set(subs.flat() as string[])];
    }
    if (trozo.some((x) => !x)) return null;
    const largos = n.min === n.max ? [n.min] : [n.min, n.max];
    out = [...new Set(out.flatMap((o) => trozo.flatMap((x) => largos.map((k) => o + x.repeat(k)))))];
    if (out.length > 3) return null;
  }
  // Variantes que sólo difieren en los dígitos son una sola forma: (0[0-9]|1[0-9]):… → «99:99».
  if (out.length > 1) {
    const formas = [...new Set(out.map((x) => x.replace(/\d/g, "9")))];
    if (formas.length === 1) return formas;
  }
  return out;
}

/** Lo que acepta el patrón, como frase nominal. null si no se deja leer. */
export function leerPatron(patron: string): Frase | null {
  const p = patron.trim();
  if (p.includes("@") && /\\\.|\[\^@/.test(p)) return [t("un correo electrónico")];
  if (/https?/i.test(p)) return [t("un enlace web")];
  let alts: Nodo[][];
  try {
    alts = new Lector(p).leer();
  } catch {
    return null;
  }
  // Una sola clase repetida: «8 dígitos», «de 2 a 4 letras», «solo números», «sin números» ([^0-9]*).
  const unica = alts.length === 1 && alts[0]!.length === 1 ? alts[0]![0]! : null;
  if (unica && unica.atomo.tipo === "clase" && unica.atomo.nombre) {
    const nombre = unica.atomo.nombre;
    if (unica.atomo.negada) return unica.min === 0 && !Number.isFinite(unica.max) ? [t("sin"), t(PLURAL_LIBRE[nombre])] : null;
    if (nombre === "dígito" && !Number.isFinite(unica.max)) return [t("solo números")];
    const [singular, plural, femenino] = nombres(unica.atomo);
    // «letras», no «una o más letras»: una o más es lo que ya dice el plural solo.
    if (unica.min === 1 && !Number.isFinite(unica.max)) return [v(plural)];
    return veces(unica, singular, plural, femenino);
  }
  const todas = enumerar(alts);
  if (todas) {
    const r = rangoNumerico(todas);
    if (r) return [t("un número de"), v(String(r[0])), t("a"), v(String(r[1]))];
    const h = rangoHoras(todas);
    if (h) return [t("una hora de"), v(h[0]), t("a"), v(h[1])];
    if (todas.length <= 5) return todas.length === 1 ? [t("solo"), v(todas[0]!)] : [t("solo"), ...todas.flatMap((x, i) => [...(i ? [t(i === todas.length - 1 ? "o" : ",")] : []), v(x)])];
  }
  if (alts.length === 1) {
    const partes = prefijoDigitos(alts[0]!) ?? porPartes(alts[0]!);
    if (partes) return partes;
    const ej = ejemplo(alts[0]!);
    if (ej) return [t("el formato"), ...ej.flatMap((x, i) => [...(i ? [t("o")] : []), v(x)])];
  }
  return null;
}

/**
 * Clase buscada en cualquier parte (sin ^ ni $): regex(., '\\s') pregunta si hay ALGÚN espacio. Devuelve el plural
 * de lo buscado («espacios», «números») para leer not(regex(., …)) como «sin espacios»; null si no es eso.
 */
export function clasePresente(patron: string): string | null {
  const p = patron.trim();
  if (p.startsWith("^") || p.endsWith("$")) return null;
  let alts: Nodo[][];
  try {
    alts = new Lector(p).leer();
  } catch {
    return null;
  }
  const n = alts.length === 1 && alts[0]!.length === 1 ? alts[0]![0]! : null;
  if (!n || n.atomo.tipo !== "clase" || n.atomo.negada || !n.atomo.nombre || n.min !== 1) return null;
  return PLURAL_LIBRE[n.atomo.nombre];
}
