// La fecha de la corrida, legible. Vive aparte para que el diálogo de rehacer
// el plan la use sin importar el componente de la sección.

/**
 * La fecha de la corrida que produjo el plan, sacada de su `run_id`.
 *
 * Los identificadores son `sel_aulas_AAAAMMDDHHMMSS_hash`: dentro está la fecha,
 * pero el hash la vuelve ilegible. Sin ella, «Origen: calc-muestra» no distingue
 * un plan de hoy de uno de hace tres semanas.
 */
export function fechaDeCorrida(runId: string | null | undefined) {
  const m = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(String(runId ?? ""));
  if (!m) return "";
  const [, a, mes, d, h, min] = m;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const mi = Number(mes) - 1;
  if (mi < 0 || mi > 11) return "";
  return `${Number(d)} ${meses[mi]} ${a}, ${h}:${min}`;
}
