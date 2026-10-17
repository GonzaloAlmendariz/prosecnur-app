// Lectura de un patrón regex como lo que ACEPTA, en una frase nominal («8 dígitos», «un número de 18 a 99»,
// «el formato 99/9999»). Se interpreta el patrón, no se compara con patrones escritos de antemano: un analizador
// pequeño (literales, clases, grupos con |, cuantificadores) que, si el lenguaje es finito, lo enumera y reconoce
// rangos numéricos; si no, describe la secuencia. Lo que no entra en ese subconjunto devuelve null (técnica).

import { cantidad, t, v, type Frase } from "./frase";

type Atomo =
  | { tipo: "car"; c: string }
  | { tipo: "clase"; chars: string[]; nombre: "dígito" | "letra" | null }
  | { tipo: "grupo"; alternativas: Nodo[][] };
type Nodo = { atomo: Atomo; min: number; max: number };

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
      if (n === "d") return { tipo: "clase", chars: DIGITOS, nombre: "dígito" };
      if (/[sSwWbB]/.test(n) || !n) throw new Error("escape");
      return { tipo: "car", c: n };
    }
    if (c === "." || c === "*" || c === "+" || c === "?" || c === "{") throw new Error("comodín");
    this.i++;
    return { tipo: "car", c };
  }

  private clase(): Atomo {
    this.i++;
    if (this.s[this.i] === "^") throw new Error("negada");
    const chars: string[] = [];
    while (this.i < this.s.length && this.s[this.i] !== "]") {
      const c = this.s[this.i]!;
      if (c === "\\") {
        const n = this.s[this.i + 1] ?? "";
        this.i += 2;
        if (n === "d") chars.push(...DIGITOS);
        else if (/[sSwW]/.test(n)) throw new Error("escape");
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
    const unicos = [...new Set(chars)];
    const todosDigitos = unicos.length === 10 && DIGITOS.every((d) => unicos.includes(d));
    const todasLetras = LETRAS.slice(0, 26).every((l) => unicos.includes(l) || unicos.includes(l.toUpperCase())) && unicos.every((x) => LETRAS.includes(x));
    return { tipo: "clase", chars: unicos, nombre: todosDigitos ? "dígito" : todasLetras ? "letra" : null };
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

/** Todas las cadenas que acepta, o null si son infinitas o demasiadas. */
function enumerar(alts: Nodo[][]): string[] | null {
  const out: string[] = [];
  for (const sec of alts) {
    let parciales = [""];
    for (const n of sec) {
      if (!Number.isFinite(n.max)) return null;
      const base = n.atomo.tipo === "car" ? [n.atomo.c] : n.atomo.tipo === "clase" ? n.atomo.chars : enumerar(n.atomo.alternativas);
      if (!base) return null;
      const reps: string[] = [];
      for (let k = n.min; k <= n.max; k++) {
        let r = [""];
        for (let j = 0; j < k; j++) {
          r = r.flatMap((x) => base.map((b) => x + b));
          if (r.length > LIMITE) return null;
        }
        reps.push(...r);
      }
      parciales = parciales.flatMap((p) => reps.map((r) => p + r));
      if (parciales.length > LIMITE) return null;
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

/** Cuántas veces: «8», «entre 2 y 4», «1 o más». */
function veces(n: Nodo, singular: string, plural: string): Frase {
  if (n.min === n.max) return [cantidad(String(n.min), singular, plural)];
  if (!Number.isFinite(n.max)) return [v(`${n.min === 0 ? "cualquier cantidad de" : n.min === 1 ? "uno o más" : `${n.min} o más`} ${plural}`)];
  return [v(`entre ${n.min} y ${n.max} ${plural}`)];
}

/** Ejemplo de la forma: [0-9]{2}/[0-9]{4} → «99/9999». null si hay repeticiones abiertas o grupos complejos. */
function ejemplo(sec: Nodo[]): string[] | null {
  let out = [""];
  for (const n of sec) {
    if (!Number.isFinite(n.max) || n.min !== n.max) return null;
    let trozo: string[];
    if (n.atomo.tipo === "car") trozo = [n.atomo.c];
    else if (n.atomo.tipo === "clase") trozo = [n.atomo.nombre === "dígito" ? "9" : n.atomo.nombre === "letra" ? "a" : n.atomo.chars.length === 1 ? n.atomo.chars[0]! : ""];
    else {
      if (n.atomo.alternativas.length > 3) return null;
      const subs = n.atomo.alternativas.map(ejemplo);
      if (subs.some((s) => !s)) return null;
      trozo = subs.flat() as string[];
    }
    if (trozo.some((x) => !x)) return null;
    out = out.flatMap((o) => trozo.map((x) => o + x.repeat(n.min)));
    if (out.length > 3) return null;
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
  // Una sola clase repetida: «8 dígitos», «entre 2 y 4 letras», «solo números».
  if (alts.length === 1 && alts[0]!.length === 1 && alts[0]![0]!.atomo.tipo === "clase" && alts[0]![0]!.atomo.nombre) {
    const n = alts[0]![0]!;
    const nombre = n.atomo.tipo === "clase" ? n.atomo.nombre : null;
    if (nombre === "dígito" && !Number.isFinite(n.max)) return [t("solo números")];
    return nombre === "dígito" ? veces(n, "dígito", "dígitos") : veces(n, "letra", "letras");
  }
  const todas = enumerar(alts);
  if (todas) {
    const r = rangoNumerico(todas);
    if (r) return [t("un número de"), v(String(r[0])), t("a"), v(String(r[1]))];
    if (todas.length <= 5) return todas.length === 1 ? [t("solo"), v(todas[0]!)] : [t("solo"), ...todas.flatMap((x, i) => [...(i ? [t(i === todas.length - 1 ? "o" : ",")] : []), v(x)])];
  }
  if (alts.length === 1) {
    const ej = ejemplo(alts[0]!);
    if (ej) return [t("el formato"), ...ej.flatMap((x, i) => [...(i ? [t("o")] : []), v(x)])];
  }
  return null;
}
