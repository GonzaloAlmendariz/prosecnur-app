// nombreUnico.ts — el nombre de una campaña no se repite (revisión de usabilidad, F1).
//
// Importar el correo de Contabilidad proponía el <title> del HTML («Encuesta de
// Reacreditación») aunque ya hubiera una campaña con ese nombre: se creaba en
// silencio y la lista quedaba con dos tarjetas idénticas. Aquí vive la regla
// que decide si un nombre choca con otro, sin React: mayúsculas, tildes y
// espacios repetidos no distinguen dos campañas a la vista.
//
// Y, para las campañas que ya existen con el mismo nombre (proyectos
// anteriores a esta regla), el subtítulo que las distingue: el actor y, si no
// lo hay, el asunto del correo.

export type CampanaConNombre = {
  id: string;
  name: string;
  archived?: boolean;
};

/** La forma en que dos nombres se ven iguales: sin tildes, sin mayúsculas y con un solo espacio. */
export function claveDeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/\s+/g, " ")
    .trim();
}

/** La campaña que ya se llama así (otra que `exceptoId`), o `null`. Un nombre vacío no choca. */
export function campanaHomonima<T extends CampanaConNombre>(
  nombre: string,
  campanas: readonly T[],
  exceptoId: string | null = null,
): T | null {
  const clave = claveDeNombre(nombre);
  if (!clave) return null;
  return campanas.find((c) => c.id !== exceptoId && claveDeNombre(c.name) === clave) ?? null;
}

export const AVISO_NOMBRE_REPETIDO = "Ya existe una campaña con este nombre";

/** El aviso en línea: abrirla, o escribir otro nombre. Una archivada no se abre desde aquí. */
export function avisoDeHomonima(c: CampanaConNombre): { texto: string; accion: string | null } {
  return c.archived
    ? { texto: `${AVISO_NOMBRE_REPETIDO}, archivada · usa otro nombre`, accion: null }
    : { texto: AVISO_NOMBRE_REPETIDO, accion: "Ábrela o usa otro nombre" };
}

/**
 * Lo que distingue a una campaña en su tarjeta y en la barra: el actor, o el
 * asunto del correo. Vacío si no hay ninguno o si repite el nombre.
 */
export function subtituloDeCampana(
  c: { name: string; actor: string },
  asunto: string | null | undefined = null,
): string {
  const nombre = claveDeNombre(c.name);
  for (const candidato of [c.actor, asunto ?? ""]) {
    const limpio = candidato.replace(/\s+/g, " ").trim();
    if (limpio && claveDeNombre(limpio) !== nombre) return limpio;
  }
  return "";
}

/** El nombre accesible del menú «⋯»: con el subtítulo, dos homónimas no se confunden. */
export function rotuloDelMenu(c: { name: string }, subtitulo: string): string {
  return subtitulo ? `Acciones de ${c.name} · ${subtitulo}` : `Acciones de ${c.name}`;
}
