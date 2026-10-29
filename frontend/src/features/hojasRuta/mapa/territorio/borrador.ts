/**
 * Borrador de distritos de Territorio (ADR 0114 §2). El borrador es lo que el
 * usuario va eligiendo; «Confirmar selección» lo vuelve `integrated_config.territorios`
 * y el backend invalida población, tamaño, cuotas y muestra. Funciones puras.
 */

/** Agrega o quita un ubigeo, conservando el orden de elección. */
export function alternar(lista: readonly string[], ubigeo: string): string[] {
  return lista.includes(ubigeo) ? lista.filter((u) => u !== ubigeo) : [...lista, ubigeo];
}

/** Suma varios ubigeos sin repetir. */
export function agregarVarios(lista: readonly string[], ubigeos: readonly string[]): string[] {
  return [...lista, ...ubigeos.filter((u, i) => !lista.includes(u) && ubigeos.indexOf(u) === i)];
}

/** Atajo de zona: si ya están todos, los quita; si falta alguno, los agrega. */
export function alternarZona(lista: readonly string[], zona: readonly string[]): string[] {
  return zona.every((u) => lista.includes(u)) ? lista.filter((u) => !zona.includes(u)) : agregarVarios(lista, zona);
}

export function cambios(confirmados: readonly string[], borrador: readonly string[]) {
  const agrega = borrador.filter((u) => !confirmados.includes(u));
  const quita = confirmados.filter((u) => !borrador.includes(u));
  return { agrega, quita, pendiente: agrega.length > 0 || quita.length > 0 };
}
