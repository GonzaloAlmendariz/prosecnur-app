/** «1 nov 2026, 10:00» en hora local; null sin fecha o con una que no se lee. */
export function fechaDelSorteo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  const hora = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dia}, ${hora}`;
}
