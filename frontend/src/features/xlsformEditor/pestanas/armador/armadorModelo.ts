// Armador de patrones (G2, aprobado 2026-10-17): una regla regex de pregunta de texto armada por partes.
// Modelo puro: bloques → regex, regex → bloques (solo lo que el armador sabe escribir), ejemplo por parte y
// prueba con el tramo que falla. La frase («9 dígitos que empiezan con 9») NO se arma aquí: sale del mismo lector
// de reglas (reglas/motor/regex.ts), para que el armador y el resto del editor digan lo mismo.

import { leerPatron } from "../../reglas/motor/regex";
import type { Frase } from "../../reglas/motor/frase";

export type TipoBloque = "digitos" | "letras" | "fijo" | "lista" | "opcional" | "avanzado";
export type ModoBloque = "exacto" | "entre" | "rango" | "mas";
export type ClaseLetras = "ambas" | "mayus" | "minus" | "tildes" | "espacios";

export type Bloque = {
  id: number;
  tipo: TipoBloque;
  modo: ModoBloque;
  n: number;
  min: number;
  max: number;
  desde: number;
  hasta: number;
  clase: ClaseLetras;
  texto: string;
  /** Opciones de «Uno de estos», separadas por comas. */
  opciones: string;
  /** Nombre de lo que mide un rango («una hora»): da el motivo «24 no es una hora». */
  rotulo?: string;
  /** Solo en «avanzado»: el fragmento tal cual, su nombre y un ejemplo válido. */
  fragmento?: string;
  nombre?: string;
  ejemplo?: string;
};

let siguienteId = 0;

const BASE: Record<TipoBloque, Partial<Bloque>> = {
  digitos: { modo: "exacto", n: 8 },
  letras: { modo: "exacto", n: 2, clase: "ambas" },
  fijo: { texto: "-" },
  lista: { opciones: "A, B" },
  opcional: { texto: "-" },
  avanzado: { fragmento: "", nombre: "un patrón", ejemplo: "" },
};

export function nuevoBloque(tipo: TipoBloque, extra: Partial<Bloque> = {}): Bloque {
  return {
    id: ++siguienteId,
    tipo,
    modo: "exacto",
    n: 1,
    min: 1,
    max: 3,
    desde: 0,
    hasta: 99,
    clase: "ambas",
    texto: "",
    opciones: "",
    ...BASE[tipo],
    ...extra,
  };
}

export type Formato = { id: string; nombre: string; ej: string; malos: string[]; bloques: () => Bloque[] };

const FRAGMENTO_CORREO = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";

export const FORMATOS: Formato[] = [
  { id: "dni", nombre: "DNI", ej: "45871236", malos: ["4587123"], bloques: () => [nuevoBloque("digitos", { n: 8 })] },
  { id: "cel", nombre: "Celular", ej: "987654321", malos: ["887654321"], bloques: () => [nuevoBloque("fijo", { texto: "9" }), nuevoBloque("digitos", { n: 8 })] },
  { id: "ruc", nombre: "RUC", ej: "20123456789", malos: ["30123456789"], bloques: () => [nuevoBloque("lista", { opciones: "10, 20" }), nuevoBloque("digitos", { n: 9 })] },
  {
    id: "hora",
    nombre: "Hora",
    ej: "08:30",
    malos: ["24:00"],
    bloques: () => [
      nuevoBloque("digitos", { modo: "rango", desde: 0, hasta: 23, rotulo: "una hora" }),
      nuevoBloque("fijo", { texto: ":" }),
      nuevoBloque("digitos", { modo: "rango", desde: 0, hasta: 59, rotulo: "un minuto" }),
    ],
  },
  { id: "anio", nombre: "Año", ej: "2026", malos: ["26"], bloques: () => [nuevoBloque("digitos", { n: 4 })] },
  {
    id: "correo",
    nombre: "Correo",
    ej: "ana@pucp.edu.pe",
    malos: ["ana@pucp"],
    bloques: () => [nuevoBloque("avanzado", { nombre: "un correo", ejemplo: "ana@pucp.edu.pe", fragmento: FRAGMENTO_CORREO })],
  },
  { id: "letras", nombre: "Solo letras", ej: "María José", malos: ["María 2"], bloques: () => [nuevoBloque("letras", { modo: "mas", clase: "espacios" })] },
  { id: "codigo", nombre: "Código", ej: "AB1234", malos: ["ab1234"], bloques: () => [nuevoBloque("letras", { n: 2, clase: "mayus" }), nuevoBloque("digitos", { n: 4 })] },
  { id: "postal", nombre: "Código postal", ej: "04001", malos: ["4001"], bloques: () => [nuevoBloque("digitos", { n: 5 })] },
];

/** Menú «Agregar»: nombre y un ejemplo en código, sin frase explicativa. */
export const MENU_AGREGAR: { tipo: TipoBloque; nombre: string; ejemplo: string }[] = [
  { tipo: "digitos", nombre: "Dígitos", ejemplo: "8765" },
  { tipo: "letras", nombre: "Letras", ejemplo: "AB" },
  { tipo: "fijo", nombre: "Texto fijo", ejemplo: "-" },
  { tipo: "lista", nombre: "Uno de estos", ejemplo: "10 · 20" },
  { tipo: "opcional", nombre: "Opcional", ejemplo: "-" },
];

// ─── Bloques → regex ─────────────────────────────────────────────────────────

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const repeticion = (min: number, max: number) =>
  max === Infinity ? (min === 0 ? "*" : min === 1 ? "+" : `{${min},}`) : min === max ? (min === 1 ? "" : `{${min}}`) : `{${min},${max}}`;

function claseDigitos(a: string, b: string) {
  return a === b ? a : `[${a}-${b}]`;
}

/** Rango de ancho fijo como alternativas: 00–23 → [0-1][0-9] | 2[0-3]. */
function rangoPartes(lo: string, hi: string): string[] {
  if (!lo.length) return [""];
  if (lo === hi) return [lo];
  const resto = lo.length - 1;
  const ceros = "0".repeat(resto);
  const nueves = "9".repeat(resto);
  const a = lo[0]!;
  const b = hi[0]!;
  const cola = resto ? (resto === 1 ? "[0-9]" : `[0-9]{${resto}}`) : "";
  if (a === b) return rangoPartes(lo.slice(1), hi.slice(1)).map((x) => a + x);
  if (lo.slice(1) === ceros && hi.slice(1) === nueves) return [claseDigitos(a, b) + cola];
  const out: string[] = [];
  let ini = Number(a);
  let fin = Number(b);
  if (lo.slice(1) !== ceros) {
    out.push(...rangoPartes(lo.slice(1), nueves).map((x) => a + x));
    ini++;
  }
  const ultimoAparte = hi.slice(1) !== nueves;
  if (ultimoAparte) fin--;
  if (ini <= fin) out.push(claseDigitos(String(ini), String(fin)) + cola);
  if (ultimoAparte) out.push(...rangoPartes(ceros, hi.slice(1)).map((x) => b + x));
  return out;
}

export function rangoRegex(desde: number, hasta: number): string {
  const ancho = Math.max(String(desde).length, String(hasta).length);
  const lo = String(Math.min(desde, hasta)).padStart(ancho, "0");
  const hi = String(Math.max(desde, hasta)).padStart(ancho, "0");
  const partes = rangoPartes(lo, hi);
  return partes.length === 1 ? partes[0]! : `(?:${partes.join("|")})`;
}

export const LETRA_CLASE: Record<ClaseLetras, string> = {
  ambas: "[A-Za-z]",
  mayus: "[A-Z]",
  minus: "[a-z]",
  tildes: "[A-Za-zÁÉÍÓÚáéíóúÑñÜü]",
  espacios: "[A-Za-zÁÉÍÓÚáéíóúÑñÜü ]",
};

export const opcionesDe = (b: Bloque) =>
  b.opciones
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function bloqueRegex(b: Bloque): string {
  switch (b.tipo) {
    case "digitos":
      if (b.modo === "rango") return rangoRegex(b.desde, b.hasta);
      if (b.modo === "mas") return "[0-9]+";
      return "[0-9]" + (b.modo === "entre" ? repeticion(b.min, Math.max(b.min, b.max)) : repeticion(b.n, b.n));
    case "letras":
      return LETRA_CLASE[b.clase] + (b.modo === "mas" ? "+" : b.modo === "entre" ? repeticion(b.min, Math.max(b.min, b.max)) : repeticion(b.n, b.n));
    case "fijo":
      return escapar(b.texto);
    case "lista": {
      const ops = opcionesDe(b);
      if (!ops.length) return "";
      return ops.length === 1 ? escapar(ops[0]!) : `(?:${ops.map(escapar).join("|")})`;
    }
    case "opcional":
      return b.texto ? `(?:${escapar(b.texto)})?` : "";
    case "avanzado":
      return b.fragmento ?? "";
  }
}

export const cuerpoRegex = (bloques: readonly Bloque[]) => bloques.map(bloqueRegex).join("");

/** La constraint que escribe el armador. Comillas dobles solo si el patrón trae una simple. */
export function constraintDe(cuerpo: string): string {
  const q = cuerpo.includes("'") ? '"' : "'";
  return `regex(., ${q}^${cuerpo}$${q})`;
}

/** El cuerpo del patrón si la constraint es exactamente regex(., '^…$'); null si es otra cosa. */
export function cuerpoDeConstraint(constraint: string): string | null {
  const m = constraint.match(/^\s*regex\(\s*\.\s*,\s*(['"])\^([\s\S]*)\$\1\s*\)\s*$/);
  return m ? m[2]! : null;
}

// ─── Regex → bloques ─────────────────────────────────────────────────────────

type Token = { atomo: string; cuant: string };

function tokenizar(s: string): Token[] | null {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ini = i;
    const c = s[i]!;
    if (c === "\\") i += 2;
    else if (c === "[") {
      i++;
      while (i < s.length && s[i] !== "]") i += s[i] === "\\" ? 2 : 1;
      if (s[i] !== "]") return null;
      i++;
    } else if (c === "(") {
      let prof = 0;
      while (i < s.length) {
        const d = s[i]!;
        if (d === "\\") i += 2;
        else if (d === "[") {
          i++;
          while (i < s.length && s[i] !== "]") i += s[i] === "\\" ? 2 : 1;
          i++;
        } else {
          if (d === "(") prof++;
          if (d === ")") prof--;
          i++;
          if (prof === 0) break;
        }
      }
      if (prof !== 0) return null;
    } else if ("*+?{)|^$.".includes(c)) return null;
    else i++;
    const atomo = s.slice(ini, i);
    let cuant = "";
    const q = s.slice(i).match(/^(\?|\+|\*|\{\d+(,\d*)?\})/);
    if (q) {
      cuant = q[0];
      i += cuant.length;
    }
    out.push({ atomo, cuant });
  }
  return out;
}

/** Texto literal sin metacaracteres sueltos («10», «\-»); null si no lo es. */
function literal(s: string): string | null {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "\\") {
      const n = s[i + 1];
      if (!n || /[dswDSWbB]/.test(n)) return null;
      out += n;
      i++;
    } else if ("[](){}|*+?.^$".includes(c)) return null;
    else out += c;
  }
  return out;
}

function cantidadDe(cuant: string): { modo: ModoBloque; n: number; min: number; max: number } | null {
  if (cuant === "") return { modo: "exacto", n: 1, min: 1, max: 3 };
  if (cuant === "+") return { modo: "mas", n: 1, min: 1, max: 3 };
  const m = cuant.match(/^\{(\d+)(,(\d+))?\}$/);
  if (!m) return null;
  if (!m[2]) return { modo: "exacto", n: Number(m[1]), min: 1, max: 3 };
  return { modo: "entre", n: 1, min: Number(m[1]), max: Number(m[3]) };
}

/** El rango que escribe rangoRegex, si el trozo es uno de ellos (0–23 → «(?:[0-1][0-9]|2[0-3])»). */
function rangoDe(trozo: string): { desde: number; hasta: number } | null {
  let re: RegExp;
  try {
    re = new RegExp(`^(?:${trozo})$`);
  } catch {
    return null;
  }
  for (let ancho = 1; ancho <= 4; ancho++) {
    let lo: number | null = null;
    let hi: number | null = null;
    for (let k = 0; k < 10 ** ancho; k++) {
      if (re.test(String(k).padStart(ancho, "0"))) {
        lo ??= k;
        hi = k;
      }
    }
    if (lo !== null && hi !== null && rangoRegex(lo, hi) === trozo) return { desde: lo, hasta: hi };
  }
  return null;
}

/** Bloques de un patrón que el armador sabe escribir; null si no lo entiende (se ofrece empezar de cero). */
export function bloquesDesdePatron(cuerpo: string): { formato: string | null; bloques: Bloque[] } | null {
  for (const f of FORMATOS) {
    const bloques = f.bloques();
    if (cuerpoRegex(bloques) === cuerpo) return { formato: f.id, bloques };
  }
  const toks = tokenizar(cuerpo);
  if (!toks || !toks.length) return null;
  const bloques: Bloque[] = [];
  let j = 0;
  while (j < toks.length) {
    const tk = toks[j]!;
    const unido = (k: number) => toks.slice(j, j + k).map((x) => x.atomo + x.cuant).join("");
    // Un rango numérico ocupa uno o varios tokens: [0-5][0-9] es 00–59.
    const abreRango = (tk.atomo.startsWith("(") && tk.cuant === "") || (tk.atomo.startsWith("[") && /^\[[0-9-]+\]$/.test(tk.atomo) && tk.atomo !== "[0-9]");
    if (abreRango) {
      let hallado = false;
      for (let k = Math.min(4, toks.length - j); k >= 1; k--) {
        const r = rangoDe(unido(k));
        if (r) {
          bloques.push(nuevoBloque("digitos", { modo: "rango", ...r }));
          j += k;
          hallado = true;
          break;
        }
      }
      if (hallado) continue;
    }
    if (tk.atomo === "[0-9]" || tk.atomo === "\\d") {
      const c = cantidadDe(tk.cuant);
      if (!c) return null;
      bloques.push(nuevoBloque("digitos", c));
      j++;
      continue;
    }
    const clase = (Object.keys(LETRA_CLASE) as ClaseLetras[]).find((k) => LETRA_CLASE[k] === tk.atomo);
    if (clase) {
      const c = cantidadDe(tk.cuant);
      if (!c) return null;
      bloques.push(nuevoBloque("letras", { ...c, clase }));
      j++;
      continue;
    }
    if (tk.atomo.startsWith("(?:")) {
      const inner = tk.atomo.slice(3, -1);
      if (tk.cuant === "?") {
        const lit = literal(inner);
        if (lit === null) return null;
        bloques.push(nuevoBloque("opcional", { texto: lit }));
      } else if (tk.cuant === "") {
        const ops = inner.split("|").map(literal);
        if (ops.some((o) => o === null || o.includes(","))) return null;
        bloques.push(nuevoBloque("lista", { opciones: ops.join(", ") }));
      } else return null;
      j++;
      continue;
    }
    const lit = tk.cuant === "" ? literal(tk.atomo) : null;
    if (lit === null) return null;
    const previo = bloques[bloques.length - 1];
    if (previo && previo.tipo === "fijo") previo.texto += lit;
    else bloques.push(nuevoBloque("fijo", { texto: lit }));
    j++;
  }
  // Solo se acepta si escribirlo de vuelta da el mismo patrón: el armador nunca reescribe lo que no entiende.
  return cuerpoRegex(bloques) === cuerpo ? { formato: null, bloques } : null;
}

// ─── Palabras ────────────────────────────────────────────────────────────────

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const anchoRango = (b: Bloque) => String(Math.max(b.desde, b.hasta)).length;
const enLista = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} o ${xs[xs.length - 1]}`);
const cita = (s: string) => (/^[\p{L}\d]+$/u.test(s) ? s : `«${s}»`);
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export const CLASE_NOMBRE: Record<ClaseLetras, [string, string]> = {
  ambas: ["letra", "letras"],
  mayus: ["letra mayúscula", "letras mayúsculas"],
  minus: ["letra minúscula", "letras minúsculas"],
  tildes: ["letra", "letras con tildes"],
  espacios: ["letra o espacio", "letras con tildes y espacios"],
};

export function nombreBloque(b: Bloque): string {
  switch (b.tipo) {
    case "digitos":
      if (b.modo === "rango") return `un número de ${pad(Math.min(b.desde, b.hasta), anchoRango(b))} a ${pad(Math.max(b.desde, b.hasta), anchoRango(b))}`;
      if (b.modo === "mas") return "dígitos";
      return b.modo === "entre" ? `de ${b.min} a ${Math.max(b.min, b.max)} dígitos` : plural(b.n, "dígito", "dígitos");
    case "letras": {
      const [s, p] = CLASE_NOMBRE[b.clase];
      return b.modo === "mas" ? p : b.modo === "entre" ? `de ${b.min} a ${Math.max(b.min, b.max)} ${p}` : plural(b.n, s, p);
    }
    case "fijo":
      return cita(b.texto);
    case "lista":
      return enLista(opcionesDe(b));
    case "opcional":
      return `${cita(b.texto)} opcional`;
    case "avanzado":
      return b.nombre ?? "";
  }
}

/** Conector de cada bloque, para que la lista se lea como una frase. */
export function conector(i: number, total: number): string {
  if (total === 1) return "Tiene";
  if (i === 0) return "Empieza con";
  if (i === total - 1) return "termina con";
  return "luego";
}

/** Rótulo corto bajo cada tramo del ejemplo. */
export function rotuloCorto(b: Bloque, i: number, total: number): string {
  const inicio = i === 0 && total > 1;
  if (b.tipo === "fijo" || b.tipo === "lista") return inicio ? `empieza con ${nombreBloque(b)}` : nombreBloque(b);
  if (b.tipo === "digitos" && b.modo === "rango" && b.rotulo) {
    const w = anchoRango(b);
    return `${b.rotulo.replace(/^una? /, "")} ${pad(Math.min(b.desde, b.hasta), w)}–${pad(Math.max(b.desde, b.hasta), w)}`;
  }
  return nombreBloque(b);
}

/** La frase de lo que acepta, del mismo lector que el resto del editor. null si no cabe en una frase. */
export function lecturaDe(bloques: readonly Bloque[]): Frase | null {
  const cuerpo = cuerpoRegex(bloques);
  if (!cuerpo) return null;
  // Sin mayúscula: continúa el rótulo «Acepta».
  return leerPatron(`^${cuerpo}$`);
}

function ejemploBloque(b: Bloque): string {
  switch (b.tipo) {
    case "digitos": {
      if (b.modo === "rango") {
        const lo = Math.min(b.desde, b.hasta);
        const hi = Math.max(b.desde, b.hasta);
        return pad(lo + Math.round((hi - lo) * 0.35), anchoRango(b));
      }
      const n = b.modo === "entre" ? b.min : b.modo === "mas" ? 4 : b.n;
      return "8765432109".repeat(4).slice(0, n);
    }
    case "letras": {
      if (b.modo === "mas") return { espacios: "María José", tildes: "Jesús", mayus: "ANA", minus: "ana", ambas: "Ana" }[b.clase];
      const n = Math.max(1, b.modo === "entre" ? b.min : b.n);
      const base = b.clase === "mayus" ? "ABCDEFGHJK" : b.clase === "minus" ? "abcdefghjk" : "Abcdefghjk";
      return base.repeat(4).slice(0, n);
    }
    case "fijo":
    case "opcional":
      return b.texto;
    case "lista":
      return opcionesDe(b)[0] ?? "";
    case "avanzado":
      return b.ejemplo ?? "";
  }
}

// ─── Segmentar y probar ──────────────────────────────────────────────────────

export type Tramo = { texto: string; i: number };

function segmentar(bloques: readonly Bloque[], texto: string, k: number, completo: boolean): Tramo[] | null {
  const bs = bloques.slice(0, k);
  let re: RegExp;
  try {
    re = new RegExp(`^${bs.map((b) => `(${bloqueRegex(b)})`).join("")}${completo ? "$" : ""}`);
  } catch {
    return null;
  }
  const m = re.exec(texto);
  return m ? bs.map((_b, i) => ({ texto: m[i + 1] ?? "", i })) : null;
}

/** Un ejemplo válido partido por bloque: el del formato si calza; si no, uno armado con cada parte. */
export function ejemploValido(bloques: readonly Bloque[], formato: string | null): Tramo[] | null {
  if (!bloques.length) return null;
  const f = FORMATOS.find((x) => x.id === formato);
  const candidatos = [...(f ? [f.ej] : []), bloques.map(ejemploBloque).join("")];
  for (const c of candidatos) {
    const s = segmentar(bloques, c, bloques.length, true);
    if (s) return s.filter((p) => p.texto);
  }
  return null;
}

export type Prueba =
  | { ok: true; tramos: Tramo[] }
  /** `ini`/`largo`: el tramo que falla. `parcial`: lo que alcanzó a calzar del bloque k antes de fallar. */
  | { ok: false; tramos: Tramo[]; k: number; ini: number; largo: number; parcial: number; hueco: boolean; motivo: string };

type Diagnostico = { largo: number; parcial?: number; hueco?: boolean; motivo: string };

function falta(nombre: string): string {
  const m = nombre.match(/^(\d+) /);
  return `${(m && m[1] !== "1") || /^de /.test(nombre) ? "faltan" : "falta"} ${nombre}`;
}

function diagnostico(b: Bloque, i: number, resto: string): Diagnostico {
  if (!resto) return { largo: 0, hueco: true, motivo: falta(nombreBloque(b)) };
  if (b.tipo === "digitos" && b.modo !== "rango") {
    const corrida = (resto.match(/^\d*/) ?? [""])[0]!.length;
    const min = b.modo === "entre" ? b.min : b.modo === "mas" ? 1 : b.n;
    if (corrida > 0 && corrida < min) {
      const final = corrida === resto.length;
      return { parcial: final ? corrida : 0, largo: final ? 0 : corrida, hueco: final, motivo: falta(plural(min - corrida, "dígito", "dígitos")) };
    }
    if (!corrida) return { largo: 1, motivo: `«${resto[0]}» no es un dígito` };
  }
  if (b.tipo === "digitos" && b.modo === "rango") {
    const w = anchoRango(b);
    const tramo = resto.slice(0, w);
    const lo = pad(Math.min(b.desde, b.hasta), w);
    const hi = pad(Math.max(b.desde, b.hasta), w);
    if (tramo.length === w && /^\d+$/.test(tramo)) return { largo: w, motivo: b.rotulo ? `${tramo} no es ${b.rotulo}` : `${tramo} no va de ${lo} a ${hi}` };
    const dig = (tramo.match(/^\d+/) ?? [""])[0]!;
    return {
      largo: Math.max(1, dig.length),
      hueco: tramo.length < w && tramo.length === resto.length,
      motivo: dig ? `van ${w} cifras, como ${dig.padStart(w, "0")}` : `«${resto[0]}» no es un dígito`,
    };
  }
  if (b.tipo === "fijo" || b.tipo === "lista") {
    const ops = b.tipo === "fijo" ? [b.texto] : opcionesDe(b);
    const largo = Math.max(1, Math.min(resto.length, ops[0]?.length ?? 1));
    const que = enLista(ops.map(cita));
    return { largo, motivo: i === 0 ? `no empieza con ${que}` : `falta ${que}` };
  }
  if (b.tipo === "letras") {
    const largo = Math.min(resto.length, b.modo === "exacto" ? b.n : 1);
    if (b.clase === "mayus" && /^[a-z]/.test(resto)) return { largo, motivo: "van en mayúscula" };
    if (b.clase === "minus" && /^[A-Z]/.test(resto)) return { largo, motivo: "van en minúscula" };
    const corrida = (resto.match(new RegExp(`^${LETRA_CLASE[b.clase]}*`)) ?? [""])[0]!.length;
    const min = b.modo === "entre" ? b.min : b.modo === "mas" ? 1 : b.n;
    if (corrida > 0 && corrida < min && corrida === resto.length) {
      return { largo: 0, parcial: corrida, hueco: true, motivo: falta(plural(min - corrida, "letra", "letras")) };
    }
    return { largo: 1, motivo: `«${resto[corrida] ?? resto[0]}» no es una letra` };
  }
  if (b.tipo === "avanzado") return { largo: resto.length, motivo: `no es ${b.nombre ?? "válido"}` };
  return { largo: 1, motivo: `falta ${nombreBloque(b)}` };
}

export function probar(bloques: readonly Bloque[], texto: string): Prueba {
  const todo = segmentar(bloques, texto, bloques.length, true);
  if (todo && bloques.length) return { ok: true, tramos: todo };
  let tramos: Tramo[] = [];
  let previo = 0;
  for (let k = 0; k < bloques.length; k++) {
    const m = segmentar(bloques, texto, k + 1, false);
    if (!m) {
      const d = diagnostico(bloques[k]!, k, texto.slice(previo));
      return { ok: false, tramos, k, ini: previo, largo: d.largo, parcial: d.parcial ?? 0, hueco: d.hueco ?? false, motivo: d.motivo };
    }
    tramos = m;
    previo = m.reduce((a, p) => a + p.texto.length, 0);
  }
  const sobra = texto.slice(previo);
  const ult = bloques[bloques.length - 1];
  if (!sobra) return { ok: false, tramos: [], k: 0, ini: 0, largo: texto.length, parcial: 0, hueco: false, motivo: "sin partes" };
  const motivo = ult && ult.tipo === "letras" && /\d/.test(sobra[0]!) ? `«${sobra[0]}» no es una letra` : `sobra ${cita(sobra)}`;
  return { ok: false, tramos, k: bloques.length, ini: previo, largo: sobra.length, parcial: 0, hueco: false, motivo };
}

// ─── Estado ──────────────────────────────────────────────────────────────────

export type EstadoArmador = {
  formato: string | null;
  bloques: Bloque[];
  ejemplos: string[];
  /** La constraint actual no es un patrón que el armador entienda: se reemplaza al aplicar. */
  reemplaza: boolean;
};

export function estadoInicial(constraint: string): EstadoArmador {
  const cuerpo = cuerpoDeConstraint(constraint);
  const leido = cuerpo !== null ? bloquesDesdePatron(cuerpo) : null;
  if (leido) {
    const f = FORMATOS.find((x) => x.id === leido.formato);
    const ej = ejemploValido(leido.bloques, leido.formato);
    return { formato: leido.formato, bloques: leido.bloques, ejemplos: f ? [f.ej, ...f.malos] : ej ? [ej.map((p) => p.texto).join("")] : [], reemplaza: false };
  }
  return { formato: null, bloques: [], ejemplos: [], reemplaza: constraint.trim().length > 0 };
}

export type AccionArmador =
  | { tipo: "formato"; id: string }
  | { tipo: "agregar"; bloque: Bloque }
  | { tipo: "mover"; id: number; delta: -1 | 1 }
  | { tipo: "quitar"; id: number }
  | { tipo: "editar"; id: number; cambios: Partial<Bloque> }
  | { tipo: "probar"; texto: string }
  | { tipo: "quitarEjemplo"; indice: number };

export function reducirArmador(e: EstadoArmador, a: AccionArmador): EstadoArmador {
  switch (a.tipo) {
    case "formato": {
      const f = FORMATOS.find((x) => x.id === a.id);
      return f ? { ...e, formato: f.id, bloques: f.bloques(), ejemplos: [f.ej, ...f.malos] } : e;
    }
    case "agregar":
      return { ...e, formato: null, bloques: [...e.bloques, a.bloque] };
    case "mover": {
      const i = e.bloques.findIndex((b) => b.id === a.id);
      const j = i + a.delta;
      if (i < 0 || j < 0 || j >= e.bloques.length) return e;
      const bs = [...e.bloques];
      [bs[i], bs[j]] = [bs[j]!, bs[i]!];
      return { ...e, formato: null, bloques: bs };
    }
    case "quitar":
      return { ...e, formato: null, bloques: e.bloques.filter((b) => b.id !== a.id) };
    case "editar":
      return { ...e, formato: null, bloques: e.bloques.map((b) => (b.id === a.id ? { ...b, ...a.cambios } : b)) };
    case "probar":
      return a.texto.trim() ? { ...e, ejemplos: [a.texto, ...e.ejemplos] } : e;
    case "quitarEjemplo":
      return { ...e, ejemplos: e.ejemplos.filter((_x, i) => i !== a.indice) };
  }
}
