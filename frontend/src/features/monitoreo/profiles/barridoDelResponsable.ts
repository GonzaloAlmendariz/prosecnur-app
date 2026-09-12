/**
 * **Cuánto barrió un responsable telefónico, y qué se dice cuando no se sabe.**
 *
 * El número de casos asignados se lee de la columna «Casos asignados» del libro
 * y es opcional: un libro a mitad de operativo no la trae. Hasta aquí los dos
 * perfiles que pintan este panel —acreditación y telefónico— resolvían esa
 * ausencia con DOS respaldos distintos en la misma pantalla:
 *
 * - la cabecera sumaba `row.assigned ?? 0`, así que anunciaba «0 personas
 *   asignadas»;
 * - cada fila calculaba `row.assigned ?? row.pending`, así que anunciaba tantas
 *   asignadas como casos le faltaban por barrer.
 *
 * Con eso, un responsable que barrió 98 de 100 salía como «2 personas
 * asignadas · 0 casos barridos · 100 % pendiente», y la cabecera decía 0 encima
 * de una lista llena de números. Cada cifra por separado parecía plausible;
 * juntas describían un operativo que no existe.
 *
 * La regla de aquí es la misma que la del resto del perfil: **un dato que no
 * está se declara, no se sustituye**. Sin «Casos asignados» no hay asignadas,
 * no hay barridos y no hay porcentaje — hay pendientes, que ésos sí se saben.
 */

export type FilaDeBarrido = {
  /** «Casos asignados» del libro; `null` cuando la columna no vino. */
  assigned: number | null;
  /** «Casos barridos» si el libro lo trae; si no, se deriva de los asignados. */
  swept: number | null;
  /** «No barridos» / «Por barrer»: siempre se conoce. */
  pending: number;
};

export type BarridoLeido = {
  asignadas: number | null;
  barridos: number | null;
  pendientes: number;
  pctBarrido: number | null;
  pctPendiente: number | null;
};

const noNegativo = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

/** Lo que se puede afirmar de un responsable. `null` es «no se sabe», nunca cero. */
export function barridoDelResponsable(fila: FilaDeBarrido): BarridoLeido {
  const pendientes = noNegativo(Number(fila.pending));
  const crudo = fila.assigned;
  const asignadas = crudo == null || !Number.isFinite(Number(crudo)) ? null : noNegativo(Number(crudo));

  if (asignadas == null) {
    // Sin la columna no hay denominador: ni barridos, ni porcentajes. Los
    // pendientes se siguen conociendo y se siguen diciendo.
    return { asignadas: null, barridos: null, pendientes, pctBarrido: null, pctPendiente: null };
  }

  const declarados = fila.swept;
  const barridos = declarados != null && Number.isFinite(Number(declarados))
    ? noNegativo(Number(declarados))
    : Math.max(0, asignadas - pendientes);

  // Un responsable con cero asignados no da un porcentaje: da una división por
  // cero disfrazada de «0 %».
  const pct = (parte: number) => (asignadas > 0 ? Math.max(0, Math.min(100, (parte / asignadas) * 100)) : null);

  return { asignadas, barridos, pendientes, pctBarrido: pct(barridos), pctPendiente: pct(pendientes) };
}

/**
 * El total de la cabecera. Suma sólo lo que se sabe y dice cuántos responsables
 * no lo traen, para que la cifra de arriba no contradiga a la lista de abajo.
 */
export function totalDeAsignadas(filas: readonly FilaDeBarrido[]): {
  valor: number | null;
  sinDato: number;
} {
  const conDato = filas.filter((fila) => barridoDelResponsable(fila).asignadas != null);
  const sinDato = filas.length - conDato.length;
  if (!conDato.length) return { valor: null, sinDato };
  const valor = conDato.reduce((suma, fila) => suma + (barridoDelResponsable(fila).asignadas ?? 0), 0);
  return { valor, sinDato };
}
