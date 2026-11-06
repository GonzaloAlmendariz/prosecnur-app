/**
 * El cierre previsto del campo en los gráficos de Avance › Ritmo (Gonzalo,
 * 2026-11-06). Es el fin de la última fase del plan de campo, la misma fecha
 * que publica el PDF (`monitoreo_cierre_previsto()` en R): una sola fuente.
 *
 * Con cierre, el eje llega hasta él; los días por venir quedan vacíos y una
 * línea marca la fecha, para ver cuánto calendario queda. Puro y con test.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** El `hasta` más tardío del plan, o `null` si ninguna fase declara fin. */
export function cierreDelPlan(plan: ReadonlyArray<{ hasta: string }>): string | null {
  const fines = plan.map((fase) => String(fase.hasta ?? "").slice(0, 10)).filter((fin) => ISO.test(fin)).sort();
  return fines.at(-1) ?? null;
}

function sumarUnDia(iso: string): string {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

export type EjeHastaCierre = {
  /** Las fechas del eje: las del campo y, después, las que faltan hasta el cierre. */
  fechas: string[];
  /** Cuántas de ellas traen dato. */
  conDato: number;
  /** Posición del cierre en el eje, o `null` sin cierre (o si cae fuera). */
  indiceDelCierre: number | null;
};

/** Estira el eje hasta el cierre previsto. Sin cierre, o con uno anterior al inicio, el eje queda igual. */
export function ejeHastaCierre(fechas: readonly string[], cierre: string | null): EjeHastaCierre {
  const base = { fechas: [...fechas], conDato: fechas.length, indiceDelCierre: null };
  const ultima = fechas.at(-1);
  if (!cierre || !ultima || !ISO.test(ultima.slice(0, 10)) || cierre < fechas[0].slice(0, 10)) return base;
  const dentro = fechas.findIndex((fecha) => fecha.slice(0, 10) === cierre);
  if (dentro >= 0) return { ...base, indiceDelCierre: dentro };
  if (cierre < ultima.slice(0, 10)) return base;
  const extendidas = [...fechas];
  let dia = ultima.slice(0, 10);
  // Tope de un año: un plan mal tecleado no debe dibujar miles de días.
  while (dia < cierre && extendidas.length < fechas.length + 366) {
    dia = sumarUnDia(dia);
    extendidas.push(dia);
  }
  return { fechas: extendidas, conDato: fechas.length, indiceDelCierre: extendidas.length - 1 };
}
