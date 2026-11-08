// «Elegir cifra» del cierre con hallazgos (ElegirCifra.tsx): las cifras de todas las láminas de resumen del informe en un
// solo control. Se agrupan por lámina de origen, con una fila por pregunta (o público) y una columna por medida cuando la
// lámina publica varias por fila (Acuerdo y Sin información, Mediana y bajo el umbral). Se buscan por texto y se ordenan
// por valor o en el orden de la lámina. Pura: sin React.
//
// La medida sale del rótulo que publica el motor (graficos_cifras_clave.R): «<pregunta>: <medida>». Se parte por el
// ÚLTIMO «: » porque la pregunta puede traer dos puntos; la medida nunca los trae. Un rótulo sin «: » (las fortalezas,
// «Biblioteca (fortalezas)») es una fila de una sola cifra.

import type { CifraClave } from "../../../../api/graficosCifras";
import type { OrigenCifras } from "./modeloCierre";

export type OrdenCifras = "valor" | "lamina";

export const ORDENES_CIFRAS: readonly { valor: OrdenCifras; rotulo: string }[] = [
  { valor: "valor", rotulo: "Valor" },
  { valor: "lamina", rotulo: "Orden de la lámina" },
];

/** Una cifra elegible: su lámina de origen y su clave. */
export type CeldaCifra = {
  /** `lamina|clave`: identifica la opción entre todas las láminas. */
  id: string;
  lamina: string;
  cifra: CifraClave;
  medida: string;
};

export type FilaCifras = {
  entidad: string;
  /** Una por medida de la lámina, en el orden de sus columnas; `null` si esa fila no publica esa medida. */
  celdas: readonly (CeldaCifra | null)[];
  /** Posición en la lámina. */
  posicion: number;
};

export type EstadoGrupo = "cargando" | "error" | "sin-cifras" | "listo";

export type GrupoCifras = {
  lamina: string;
  nombre: string;
  /** Las medidas de la lámina, en el orden en que aparecen; `[""]` si cada fila tiene una sola cifra sin medida. */
  medidas: readonly string[];
  filas: readonly FilaCifras[];
  estado: EstadoGrupo;
  error: string | null;
};

export type CifrasLeidas = { cifras: readonly CifraClave[] | null; cargando: boolean; error: string | null };

export const idCelda = (lamina: string, clave: string): string => `${lamina}|${clave}`;

/** «Biblioteca: acuerdo» → pregunta «Biblioteca», medida «acuerdo». */
export function partirRotulo(rotulo: string): { entidad: string; medida: string } {
  const i = rotulo.lastIndexOf(": ");
  if (i <= 0) return { entidad: rotulo, medida: "" };
  return { entidad: rotulo.slice(0, i), medida: rotulo.slice(i + 2) };
}

/** La medida como encabezado de columna: «acuerdo» → «Acuerdo». */
export const encabezadoMedida = (m: string): string => (m ? m.charAt(0).toLocaleUpperCase("es") + m.slice(1) : m);

/** Las cifras de una lámina de origen, en filas por pregunta y columnas por medida. */
export function agruparCifras(origen: Pick<OrigenCifras, "id" | "nombre">, leidas: CifrasLeidas | undefined): GrupoCifras {
  const base = { lamina: origen.id, nombre: origen.nombre };
  if (!leidas || (leidas.cargando && !leidas.cifras)) return { ...base, medidas: [], filas: [], estado: "cargando", error: null };
  if (leidas.error) return { ...base, medidas: [], filas: [], estado: "error", error: leidas.error };
  const cifras = leidas.cifras ?? [];
  if (cifras.length === 0) return { ...base, medidas: [], filas: [], estado: "sin-cifras", error: null };

  const medidas: string[] = [];
  const porEntidad = new Map<string, Map<string, CeldaCifra>>();
  for (const c of cifras) {
    const { entidad, medida } = partirRotulo(c.rotulo);
    if (!medidas.includes(medida)) medidas.push(medida);
    const fila = porEntidad.get(entidad) ?? new Map<string, CeldaCifra>();
    if (!fila.has(medida)) fila.set(medida, { id: idCelda(origen.id, c.clave), lamina: origen.id, cifra: c, medida });
    porEntidad.set(entidad, fila);
  }
  const filas = [...porEntidad.entries()].map(([entidad, fila], posicion): FilaCifras => ({
    entidad, posicion, celdas: medidas.map((m) => fila.get(m) ?? null),
  }));
  return { ...base, medidas, filas, estado: "listo", error: null };
}

const normalizar = (t: string): string => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Lo que se busca de una fila: la lámina, la pregunta, sus medidas y sus cifras. */
function textoDeFila(g: GrupoCifras, f: FilaCifras): string {
  const celdas = f.celdas.flatMap((c) => (c ? [c.medida, c.cifra.texto, c.cifra.rotulo] : []));
  return normalizar([g.nombre, f.entidad, ...celdas].join(" "));
}

/**
 * Filtra por todas las palabras de la búsqueda (sin tildes ni mayúsculas). Un grupo sin filas que casen sale; uno que
 * todavía carga o que falló se queda sólo si la búsqueda está vacía o casa con su nombre.
 */
export function buscarCifras(grupos: readonly GrupoCifras[], consulta: string): GrupoCifras[] {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [...grupos];
  const casa = (t: string) => palabras.every((p) => t.includes(p));
  return grupos.flatMap((g): GrupoCifras[] => {
    if (g.estado !== "listo") return casa(normalizar(g.nombre)) ? [g] : [];
    const filas = g.filas.filter((f) => casa(textoDeFila(g, f)));
    return filas.length ? [{ ...g, filas }] : [];
  });
}

/** Una diferencia en puntos (la del contraste, `diferencia:*`, unidad «pts»): pesa por su tamaño, no por su signo. */
export const esDiferencia = (c: Pick<CifraClave, "clave" | "unidad">): boolean => c.unidad === "pts" || c.clave.startsWith("diferencia:");

/** El valor por el que se ordena una fila: el de su primera columna con valor; si es una diferencia, su valor absoluto (C5). */
export function valorDeFila(f: FilaCifras): number | null {
  for (const c of f.celdas) if (c && c.cifra.valor !== null) return esDiferencia(c.cifra) ? Math.abs(c.cifra.valor) : c.cifra.valor;
  return null;
}

/**
 * Dentro de cada lámina, de mayor a menor valor (sin valor al final) o en el orden de la lámina. Las diferencias van de
 * mayor a menor tamaño: −14 pts antes que +9 pts. Las láminas no se mueven.
 */
export function ordenarCifras(grupos: readonly GrupoCifras[], orden: OrdenCifras): GrupoCifras[] {
  return grupos.map((g) => {
    const filas = [...g.filas].sort((a, b) => {
      if (orden === "lamina") return a.posicion - b.posicion;
      const va = valorDeFila(a);
      const vb = valorDeFila(b);
      if (va === null && vb === null) return a.posicion - b.posicion;
      if (va === null) return 1;
      if (vb === null) return -1;
      return vb - va || a.posicion - b.posicion;
    });
    return { ...g, filas };
  });
}

/** Los ids de las opciones como se recorren con el teclado: una fila por pregunta, una columna por medida. */
export function rejillaDeOpciones(grupos: readonly GrupoCifras[]): (string | null)[][] {
  return grupos.flatMap((g) => g.filas.map((f) => f.celdas.map((c) => (c ? c.id : null))));
}

export type Movimiento = "arriba" | "abajo" | "izquierda" | "derecha" | "inicio" | "fin";

const primeraDe = (fila: readonly (string | null)[]): string | null => fila.find((x): x is string => x !== null) ?? null;

/** La opción más cercana a la columna `col` dentro de una fila. */
function cercanaA(fila: readonly (string | null)[], col: number): string | null {
  if (fila[col]) return fila[col];
  for (let d = 1; d < fila.length; d += 1) {
    if (fila[col - d]) return fila[col - d];
    if (fila[col + d]) return fila[col + d];
  }
  return null;
}

/**
 * La opción activa tras una tecla. Sin activa, «abajo» o «inicio» entran por la primera y «arriba» o «fin» por la
 * última. Arriba y abajo conservan la columna; izquierda y derecha no salen de la fila; no da la vuelta.
 */
export function moverActiva(rejilla: readonly (readonly (string | null)[])[], activa: string | null, mov: Movimiento): string | null {
  const filas = rejilla.filter((f) => primeraDe(f) !== null);
  if (filas.length === 0) return null;
  const ultima = filas[filas.length - 1];
  const ultimaDe = (f: readonly (string | null)[]) => [...f].reverse().find((x): x is string => x !== null) ?? null;
  const r = activa === null ? -1 : filas.findIndex((f) => f.includes(activa));
  if (r < 0) return mov === "arriba" || mov === "fin" ? ultimaDe(ultima) : primeraDe(filas[0]);
  const fila = filas[r];
  const c = fila.indexOf(activa);
  switch (mov) {
    case "inicio": return primeraDe(filas[0]);
    case "fin": return ultimaDe(ultima);
    case "abajo": return r + 1 < filas.length ? cercanaA(filas[r + 1], c) : activa;
    case "arriba": return r > 0 ? cercanaA(filas[r - 1], c) : activa;
    case "izquierda": {
      for (let k = c - 1; k >= 0; k -= 1) if (fila[k]) return fila[k];
      return activa;
    }
    case "derecha": {
      for (let k = c + 1; k < fila.length; k += 1) if (fila[k]) return fila[k];
      return activa;
    }
  }
}

/** La celda de un id, para elegirla. */
export function celdaDe(grupos: readonly GrupoCifras[], id: string): CeldaCifra | null {
  for (const g of grupos) for (const f of g.filas) for (const c of f.celdas) if (c && c.id === id) return c;
  return null;
}

/** Cuántas cifras quedan a la vista. */
export const cifrasVisibles = (grupos: readonly GrupoCifras[]): number =>
  grupos.reduce((n, g) => n + g.filas.reduce((m, f) => m + f.celdas.filter(Boolean).length, 0), 0);

/** Qué filas tienen varias opciones (para decidir si izquierda y derecha mueven la activa o el cursor del buscador). */
export function filaConVarias(rejilla: readonly (readonly (string | null)[])[], activa: string | null): boolean {
  if (activa === null) return false;
  const fila = rejilla.find((f) => f.includes(activa));
  return !!fila && fila.filter(Boolean).length > 1;
}
