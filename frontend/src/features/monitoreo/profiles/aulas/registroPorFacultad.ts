/**
 * La facultad como eje del registro de campo.
 *
 * La lista de «Aulas aplicadas (campo)» enseña 170 cursos-horario seguidos, sin
 * facultad y sin manera de acotarlos. Y el trabajo de campo no se organiza por
 * curso-horario sino por facultad: se sale a una facultad y se hacen las aulas
 * que hay ahí. Gonzalo: «muchas veces no es por curso-horario que se hace,
 * muchas veces es por facultad… yo quiero ir a tal facultad».
 *
 * El patrón es el del banco de extras: las facultades son **filtro y resumen a
 * la vez**, así que la misma fila dice cuánto queda ahí y sirve para entrar. Dos
 * superficies —una tabla de resumen y un selector aparte— repetirían el cruce.
 */

type Fila = Readonly<Record<string, unknown>>;

const txt = (v: unknown) => String(v ?? "").trim();

export type FacultadDelRegistro = {
  facultad: string;
  aulas: number;
  /** De ésas, las que ya tienen parte en el libro. */
  conParte: number;
};

/**
 * Las facultades de la agenda, con cuánto queda por registrar en cada una.
 *
 * @param filas la agenda ya filtrada de lo que no se visita.
 * @param conParte códigos que ya tienen parte.
 */
export function facultadesDelRegistro(
  filas: ReadonlyArray<Fila>,
  conParte: ReadonlySet<string>,
): FacultadDelRegistro[] {
  const mapa = new Map<string, FacultadDelRegistro>();
  for (const row of filas) {
    // Vacía y no «Sin facultad»: la etiqueta la pone la vista, que es donde se
    // sabe si el hueco se dice o se calla.
    const facultad = txt(row.faculty);
    if (!facultad) continue;
    const f = mapa.get(facultad) ?? { facultad, aulas: 0, conParte: 0 };
    f.aulas += 1;
    if (conParte.has(txt(row.operational_code))) f.conParte += 1;
    mapa.set(facultad, f);
  }
  // Por lo que FALTA por registrar, no por tamaño ni alfabético: la lista existe
  // para elegir a dónde ir, y a donde se va es donde queda trabajo.
  return [...mapa.values()].sort(
    (a, b) => (b.aulas - b.conParte) - (a.aulas - a.conParte)
      || b.aulas - a.aulas
      || a.facultad.localeCompare(b.facultad, "es"),
  );
}

/**
 * El nombre del aula, sin decir dos veces lo mismo.
 *
 * Salía «CH 1 · Curso CH 1» porque el nombre del curso ya contiene su código.
 * Repetirlo gasta la mitad de la línea en no decir nada, y en una lista de 170
 * es la mitad de lo único que se lee.
 */
export function etiquetaSinRepetir(codigo: string, curso: string): string {
  const c = codigo.trim();
  const n = curso.trim();
  if (!c) return n || "Curso-horario sin identificar";
  if (!n) return c;
  // El curso ya nombra su código —«Curso CH 1», «CH 1 - Cálculo»—: basta el
  // nombre, que es el que distingue.
  const normal = (s: string) => s.toLowerCase().replace(/[\s·.\-–—]+/g, " ").trim();
  if (normal(n).includes(normal(c))) return n;
  return `${c} · ${n}`;
}
