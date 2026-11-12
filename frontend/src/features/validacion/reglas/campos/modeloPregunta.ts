/**
 * Cómo se nombra y se busca una pregunta en el selector del panel de regla
 * (ítem 9 del checklist del practicante).
 *
 * En una batería el rótulo suele traer el enunciado común delante del ítem
 * ("P7. A continuación, te presentamos ... 1. Puedo compartir mis ideas"). En
 * una línea con elipsis se veía el enunciado y se cortaba justo antes del ítem,
 * que es lo único que distingue una pregunta de su vecina. Aquí el ítem va
 * primero y el enunciado aparte; lo que no es batería queda como está.
 */
import type { ExploradorVariable } from "../../types";

export type PartesDePregunta = {
  /** Lo que distingue a la pregunta: el ítem en una batería, el rótulo entero si no. */
  texto: string;
  /** El enunciado que comparte con sus vecinas de batería; `null` si no es batería. */
  enunciado: string | null;
};

/** Largo mínimo del enunciado común para leerlo como batería y no como coincidencia ("P1. ..."). */
const ENUNCIADO_MINIMO = 16;

/** Minúsculas y sin tildes, para que "region" encuentre "Región". */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function rotuloDe(v: ExploradorVariable): string {
  const r = (v.label ?? "").trim();
  return r && r !== v.name ? r : "";
}

/** El prefijo común de dos rótulos, cortado en el último espacio para no partir una palabra. */
function prefijoComun(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (i === a.length || i === b.length) return "";
  const corte = a.lastIndexOf(" ", i);
  return corte > 0 ? a.slice(0, corte + 1) : "";
}

/**
 * Las partes de cada pregunta, por su código. El enunciado de una batería es
 * el prefijo que la pregunta comparte con su vecina anterior o siguiente en el
 * orden del formulario (el más largo de los dos).
 */
export function partesDePreguntas(variables: readonly ExploradorVariable[]): Map<string, PartesDePregunta> {
  const rotulos = variables.map(rotuloDe);
  const partes = new Map<string, PartesDePregunta>();
  variables.forEach((v, i) => {
    const r = rotulos[i];
    const antes = i > 0 && rotulos[i - 1] ? prefijoComun(r, rotulos[i - 1]) : "";
    const despues = i < rotulos.length - 1 && rotulos[i + 1] ? prefijoComun(r, rotulos[i + 1]) : "";
    const comun = antes.length >= despues.length ? antes : despues;
    const item = r.slice(comun.length).trim();
    if (comun.trim().length >= ENUNCIADO_MINIMO && item) {
      // Sin el guion o los dos puntos que unían el enunciado con el ítem ("Lugar de nacimiento - Región").
      partes.set(v.name, { texto: item, enunciado: comun.trim().replace(/[\s:,\u2013-]+$/, "") });
    } else {
      partes.set(v.name, { texto: r, enunciado: null });
    }
  });
  return partes;
}

/**
 * Las preguntas que calzan con lo escrito, por código o por rótulo. Cada
 * palabra escrita tiene que aparecer; primero el código exacto, después los
 * códigos que empiezan con lo escrito y luego el resto, en el orden del
 * formulario.
 */
export function filtrarPreguntas(variables: readonly ExploradorVariable[], consulta: string): ExploradorVariable[] {
  const q = normalizarBusqueda(consulta.trim());
  if (!q) return [...variables];
  const palabras = q.split(/\s+/).filter(Boolean);
  const rango = (v: ExploradorVariable): number => {
    const codigo = normalizarBusqueda(v.name);
    if (codigo === q) return 0;
    if (codigo.startsWith(q)) return 1;
    return 2;
  };
  return variables
    .map((v, orden) => ({ v, orden, texto: normalizarBusqueda(`${v.name} ${v.label ?? ""}`) }))
    .filter(({ texto }) => palabras.every((p) => texto.includes(p)))
    .sort((a, b) => rango(a.v) - rango(b.v) || a.orden - b.orden)
    .map(({ v }) => v);
}
