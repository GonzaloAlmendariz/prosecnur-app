import type { ArgMetadata } from "../../api/client";

// Búsqueda de ajustes, compartida por las dos superficies que los exponen: el
// panel de Estilo global y el inspector de la lámina.
//
// Vive aquí y no dentro de un componente porque el loop de la interfaz ya la
// necesitó dos veces, y dos copias de la misma regla se separan: una
// aprendería a ignorar tildes y la otra no, y el analista vería resultados
// distintos según por qué panel entró.

/** Compara sin tildes, para buscar como se escribe rápido.
 *
 *  «mayusculas» tiene que encontrar «MAYÚSCULAS» y «numerico» a «numérico»:
 *  quien busca a toda prisa no pone tildes, y el ajuste sí las lleva porque su
 *  copy está bien escrito. `NFD` separa la tilde de su letra y el rango la
 *  retira. */
export function sinTildes(x: string): string {
  return x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtra por nombre técnico y por lo que el ajuste HACE.
 *
 *  Se busca también en la etiqueta y la descripción porque quien quiere
 *  cambiar «el ancho de las etiquetas» no sabe que el argumento se llama
 *  `canvas_w_etiquetas`. Todos los términos deben aparecer: con dos palabras
 *  se acota, no se amplía.
 *
 *  Con la consulta vacía devuelve la lista intacta — el filtro es un añadido,
 *  no una reorganización. */
export function filtrarAjustes<T extends ArgMetadata>(args: T[], busqueda: string): T[] {
  const q = sinTildes((busqueda ?? "").trim());
  if (!q) return args;
  const terminos = q.split(/\s+/).filter(Boolean);
  if (!terminos.length) return args;
  return args.filter((a) => {
    const heno = sinTildes(
      [a.name, a.label, a.descripcion, a.efecto, a.unidad].filter(Boolean).join(" "),
    );
    return terminos.every((t) => heno.includes(t));
  });
}
