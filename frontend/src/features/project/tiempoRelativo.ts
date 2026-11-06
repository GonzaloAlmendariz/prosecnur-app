// «hace 2 min» del proyecto. Vive aparte para que MotivosSinGuardar no
// importe ProjectLifecycleDialog, que lo importa a él (ciclo).

export function projectRelTime(iso: string | null): string {
  if (!iso) return "nunca";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diff = (Date.now() - t) / 1000;
  if (diff < 30) return "hace un momento";
  if (diff < 90) return "hace un minuto";
  if (diff < 60 * 60) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 60 * 60 * 24) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("es-PE");
}
