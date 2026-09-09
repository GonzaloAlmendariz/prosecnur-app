/**
 * El reparto por rol de la tabla «Avance por curso-horario».
 *
 * Gonzalo, el 2026-09-09: «no se pueden ver todos, por qué no hay un selector
 * entre titulares y reemplazo 1, 2 etc». Tenía razón y el defecto era de
 * alcance, no de estética: el motor manda 500 filas de las 1 392 del plan y las
 * ordena por dónde está cada curso-horario en el circuito, así que los 174
 * titulares encabezan y las 326 reservas quedan al fondo de una tabla de 500 sin
 * ninguna forma de pedirlas. Eso incumple C4 —todo alcanzable— con una tabla que
 * además se lee como un censo.
 *
 * **Lo que este view-model NO puede arreglar, y por eso lo publica.** Las 892
 * filas que el motor no manda no están aquí y ningún filtro las va a traer: el
 * recorte es del payload. `restantes` existe para que la pantalla lo diga en vez
 * de dejar creer que 500 son el plan.
 */

export type RolDeCursoHorario = "todos" | "titular" | "reserva";

export type RepartoPorRol = {
  titulares: number;
  reservas: number;
  /** Lo que llegó, sumado. */
  recibidas: number;
  /** Lo que el plan tiene y el motor no mandó. */
  restantes: number;
  total: number;
};

/** El rol tal como lo escribe el plan; vacío cuenta como titular. */
export function esTitular(fila: Record<string, unknown>): boolean {
  const rol = String(fila.sample_role ?? "").trim();
  return !rol || rol === "titular";
}

export function repartoPorRol(
  filas: ReadonlyArray<Record<string, unknown>>,
  total: number,
): RepartoPorRol {
  const titulares = filas.filter(esTitular).length;
  const recibidas = filas.length;
  return {
    titulares,
    reservas: recibidas - titulares,
    recibidas,
    // Nunca negativo: si el motor mandara más de lo que declara como total, la
    // resta diría «-3 sin traer» y eso no significa nada para quien lee.
    restantes: Math.max(0, (Number.isFinite(total) ? total : recibidas) - recibidas),
    total: Number.isFinite(total) ? total : recibidas,
  };
}

export function filasDelRol(
  filas: ReadonlyArray<Record<string, unknown>>,
  rol: RolDeCursoHorario,
): ReadonlyArray<Record<string, unknown>> {
  if (rol === "todos") return filas;
  // **Se filtra, no se reordena.** El orden lo pone el motor —en campo primero,
  // y dentro de cada tramo por brecha— y es el que el subtítulo promete. Un
  // `sort` aquí rompería esa promesa sin que nadie lo note.
  return rol === "titular" ? filas.filter(esTitular) : filas.filter((f) => !esTitular(f));
}
