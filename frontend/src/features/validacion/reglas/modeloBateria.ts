/**
 * Elegir las preguntas de una batería ("Patrón en una batería"): buscar, elegir
 * un grupo entero y mantener el orden del formulario. El orden importa: la
 * frase nombra la batería por su primera y su última pregunta.
 *
 * Un grupo es la sección del formulario de la pregunta o, cuando la sección no
 * separa la batería (todas en una sola sección), la raíz de su código: `p29_1`
 * a `p29_14` comparten `p29`. Las preguntas se cruzan por su código, nunca por
 * su rótulo.
 */
import type { ExploradorVariable } from "../types";

/** Una pregunta del inventario con la sección del formulario donde vive, si se conoce. */
export type PreguntaConSeccion = ExploradorVariable & { seccion?: string };

export type GrupoDeBateria = {
  clave: string;
  /** "la sección "Amigos"" o "las que empiezan con p29". */
  rotulo: string;
  preguntas: string[];
};

/** La raíz del código de una pregunta numerada (`p29_3` y `p29.3` dan `p29`), o `null`. */
export function raizDelCodigo(nombre: string): string | null {
  const m = /^(.+?)[_.]\d+$/.exec(nombre.trim());
  return m ? m[1] : null;
}

/** Las elegidas en el orden del formulario; las que ya no están en la base van primero, como llegaron. */
export function enOrdenDelFormulario(elegidas: readonly string[], variables: readonly ExploradorVariable[]): string[] {
  const set = new Set(elegidas.filter(Boolean));
  const conocidas = new Set(variables.map((v) => v.name));
  const ausentes = elegidas.filter((n, i) => n && !conocidas.has(n) && elegidas.indexOf(n) === i);
  return [...ausentes, ...variables.filter((v) => set.has(v.name)).map((v) => v.name)];
}

/** Las preguntas que coinciden con la búsqueda, por código o por rótulo. */
export function buscarPreguntas(q: string, variables: readonly ExploradorVariable[], tope = 60): ExploradorVariable[] {
  const t = q.trim().toLocaleLowerCase("es");
  if (!t) return [];
  return variables
    .filter((v) => v.name.toLocaleLowerCase("es").includes(t) || (v.label ?? "").toLocaleLowerCase("es").includes(t))
    .slice(0, tope);
}

/**
 * Los grupos que se pueden elegir enteros a partir de unas preguntas: su
 * sección (si tiene al menos dos preguntas y no es la base entera) y la raíz
 * de su código. Sin repetir el mismo conjunto dos veces.
 */
export function gruposDeBateria(desde: readonly string[], variables: readonly PreguntaConSeccion[], tope = 3): GrupoDeBateria[] {
  const porNombre = new Map(variables.map((v) => [v.name, v]));
  const grupos: GrupoDeBateria[] = [];
  const vistos = new Set<string>();
  const agregar = (clave: string, rotulo: string, preguntas: string[]) => {
    const firma = preguntas.join("\u0000");
    if (preguntas.length < 2 || vistos.has(firma)) return;
    vistos.add(firma);
    grupos.push({ clave, rotulo, preguntas });
  };
  for (const nombre of desde) {
    const v = porNombre.get(nombre);
    if (!v) continue;
    const raiz = raizDelCodigo(v.name);
    if (raiz) {
      agregar(`raiz:${raiz}`, `las que empiezan con ${raiz}`, variables.filter((x) => raizDelCodigo(x.name) === raiz).map((x) => x.name));
    }
    const seccion = (v.seccion ?? "").trim();
    if (seccion) {
      const deLaSeccion = variables.filter((x) => (x.seccion ?? "").trim() === seccion).map((x) => x.name);
      if (deLaSeccion.length < variables.length) agregar(`seccion:${seccion}`, `la sección "${seccion}"`, deLaSeccion);
    }
    if (grupos.length >= tope) break;
  }
  return grupos.slice(0, tope);
}
