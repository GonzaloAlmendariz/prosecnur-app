// Diferencias por palabra entre los dos textos de un par (evidencia de «Revisar emparejado», X6). Las palabras se
// comparan normalizadas (sin tildes, minúsculas, sin signos: coincidencia.ts) y se alinean por la subsecuencia común
// más larga; lo que queda fuera de ella se marca como distinto en cada lado. A diferencia del puntaje, aquí cuentan
// también las palabras vacías: la evidencia muestra todo lo que cambia.

import { normalizarTexto } from "./coincidencia";

export type Trozo = { texto: string; distinto: boolean };
export type DiffPar = { a: Trozo[]; b: Trozo[] };

type Pieza = { texto: string; clave: string | null };

/** Palabras y espacios en su orden; un espacio o un signo suelto no tiene clave y nunca se marca. */
function piezas(texto: string): Pieza[] {
  return texto.split(/(\s+)/).filter(Boolean).map((t) => {
    const clave = /^\s+$/.test(t) ? "" : normalizarTexto(t);
    return { texto: t, clave: clave || null };
  });
}

/** Índices (en `a` y en `b`) de las palabras que forman la subsecuencia común más larga. */
function comunes(a: readonly string[], b: readonly string[]): { a: Set<number>; b: Set<number> } {
  const n = a.length;
  const m = b.length;
  const largo: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      largo[i][j] = a[i] === b[j] ? largo[i + 1][j + 1] + 1 : Math.max(largo[i + 1][j], largo[i][j + 1]);
    }
  }
  const ea = new Set<number>();
  const eb = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ea.add(i); eb.add(j); i += 1; j += 1; }
    else if (largo[i + 1][j] >= largo[i][j + 1]) i += 1;
    else j += 1;
  }
  return { a: ea, b: eb };
}

/** Une los trozos vecinos del mismo tipo; el espacio entre dos palabras distintas queda dentro de la marca. */
function unir(trozos: readonly Trozo[]): Trozo[] {
  const out: Trozo[] = [];
  trozos.forEach((t, k) => {
    const espacio = /^\s+$/.test(t.texto);
    const distinto = espacio ? (out[out.length - 1]?.distinto ?? false) && (trozos[k + 1]?.distinto ?? false) : t.distinto;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.distinto === distinto) ultimo.texto += t.texto;
    else out.push({ texto: t.texto, distinto });
  });
  return out;
}

function marcar(lista: readonly Pieza[], palabras: readonly number[], iguales: ReadonlySet<number>): Trozo[] {
  const enLista = new Map(palabras.map((pos, k) => [pos, k]));
  return unir(lista.map((p, pos) => {
    const k = enLista.get(pos);
    return { texto: p.texto, distinto: k !== undefined && !iguales.has(k) };
  }));
}

export function diffPorPalabra(a: string, b: string): DiffPar {
  const pa = piezas(a);
  const pb = piezas(b);
  const ia = pa.flatMap((p, pos) => (p.clave ? [pos] : []));
  const ib = pb.flatMap((p, pos) => (p.clave ? [pos] : []));
  const lcs = comunes(ia.map((pos) => pa[pos].clave ?? ""), ib.map((pos) => pb[pos].clave ?? ""));
  return { a: marcar(pa, ia, lcs.a), b: marcar(pb, ib, lcs.b) };
}
