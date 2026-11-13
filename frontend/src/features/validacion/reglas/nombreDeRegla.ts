/**
 * El nombre que una regla propia nueva se pone sola (ítem 45.4): el rótulo de
 * su tipo y sus preguntas, cada una con su etiqueta corta o, si no la tiene,
 * con su código, en el orden de sus papeles (departamento, provincia,
 * distrito; el grupo y luego el valor). Y el sufijo "(copia)" para que dos
 * reglas no queden con el mismo nombre.
 */
import type { ExploradorVariable } from "../types";

const LARGO_MAXIMO_DE_ETIQUETA = 28;
const SUFIJO_DE_COPIA = /\s\(copia(?:\s\d+)?\)$/i;

/** Una etiqueta que es una frase o un enunciado no sirve de nombre. */
function esCorta(texto: string): boolean {
  return texto.length > 0 && texto.length <= LARGO_MAXIMO_DE_ETIQUETA && !/[.?¿:]/.test(texto);
}

/**
 * La etiqueta corta de una pregunta, o "" si no la tiene. De "P1. Lugar de
 * nacimiento: distrito" sale "distrito"; "Año de egreso" se queda; un
 * enunciado entero no cuenta.
 */
export function etiquetaCortaDe(variable: Pick<ExploradorVariable, "name" | "label"> | undefined): string {
  const completa = (variable?.label ?? "").trim();
  if (!completa || completa === variable?.name) return "";
  // El número de la pregunta que abre la etiqueta ("P3. Edad") no es parte del nombre.
  const etiqueta = completa.replace(/^[A-Za-z]{0,3}\d+(?:\.\d+)*[.)\s-]+\s*/, "") || completa;
  const cola = etiqueta.includes(": ") ? etiqueta.slice(etiqueta.lastIndexOf(": ") + 2).trim() : "";
  if (cola && !/^\d/.test(cola) && esCorta(cola)) return cola;
  return esCorta(etiqueta) ? etiqueta : "";
}

/**
 * Cómo se llama cada pregunta en el nombre de la regla: su etiqueta corta o su
 * código. Si dos preguntas de la regla darían la misma etiqueta, esas dos van
 * por su código, para que el nombre las distinga.
 */
export function nombresDeLasPreguntas(codigos: readonly string[], inventario: readonly ExploradorVariable[]): string[] {
  const porCodigo = new Map(inventario.map((v) => [v.name, v]));
  const cortas = codigos.map((c) => etiquetaCortaDe(porCodigo.get(c)));
  // Lo que se leería de cada pregunta: su etiqueta corta o su código. Si dos se leen igual
  // ("distrito" de una pregunta con etiqueta y "distrito" de una columna sin ella), las que
  // vienen de una etiqueta van por su código.
  const leidas = codigos.map((c, i) => cortas[i] || c);
  const veces = new Map<string, number>();
  for (const e of leidas) veces.set(e.toLowerCase(), (veces.get(e.toLowerCase()) ?? 0) + 1);
  return codigos.map((c, i) => (cortas[i] && veces.get(leidas[i].toLowerCase()) === 1 ? cortas[i] : c));
}

/** "a", "a y b", "a, b y c". */
export function listaEnTexto(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function clave(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/**
 * El nombre sin repetir uno en uso: el mismo, o con " (copia)", o con
 * " (copia 2)", " (copia 3)"… hasta que ninguna regla lo lleve.
 */
export function nombreSinRepetir(nombre: string, enUso: readonly string[]): string {
  const usados = new Set(enUso.map(clave));
  if (!usados.has(clave(nombre))) return nombre;
  const base = nombre.replace(SUFIJO_DE_COPIA, "");
  let candidato = `${base} (copia)`;
  for (let n = 2; usados.has(clave(candidato)); n += 1) candidato = `${base} (copia ${n})`;
  return candidato;
}

/** El cuerpo a guardar con un nombre que ninguna otra regla lleva; el detalle que era el nombre lo sigue. */
export function conNombreUnico<T extends { nombre: string; mensaje: string }>(cuerpo: T, enUso: readonly string[]): T {
  const nombre = nombreSinRepetir(cuerpo.nombre, enUso);
  if (nombre === cuerpo.nombre) return cuerpo;
  return { ...cuerpo, nombre, mensaje: cuerpo.mensaje === cuerpo.nombre ? nombre : cuerpo.mensaje };
}
