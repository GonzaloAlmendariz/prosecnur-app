import type { HojasRutaSamplePreview, QuotaPlan } from "../../../api/hojasRuta";
import type { TabHeadingChip } from "../../../components/TabHeading";

/**
 * Las cifras de la selección en la cabecera de la pestaña. Las cuotas llevan su
 * base («1.200 / 1.200») y se marcan en aviso cuando no cuadran; sin muestra
 * sorteada no hay titulares ni reemplazos que contar, así que esos chips no
 * aparecen en vez de decir «0».
 */
export function chipsDeSeleccion(
  quota: Pick<QuotaPlan, "total_asignado" | "n_objetivo"> | null,
  sample: Pick<HojasRutaSamplePreview, "n_blocks" | "n_replacement_blocks" | "total_entrevistas"> | null,
): TabHeadingChip[] {
  const chips: TabHeadingChip[] = [];
  if (quota) {
    chips.push({
      id: "cuotas",
      label: "cuotas",
      valor: quota.total_asignado,
      base: quota.n_objetivo,
      rank: 1,
      tono: quota.total_asignado === quota.n_objetivo ? "ok" : "warn",
    });
  }
  if (sample) {
    chips.push({ id: "titulares", label: "titulares", valor: sample.n_blocks, rank: 1 });
    chips.push({ id: "entrevistas", label: "entrevistas", valor: sample.total_entrevistas, rank: 2 });
    chips.push({ id: "reemplazos", label: "reemplazos", valor: sample.n_replacement_blocks ?? 0, rank: 3 });
  }
  return chips;
}
