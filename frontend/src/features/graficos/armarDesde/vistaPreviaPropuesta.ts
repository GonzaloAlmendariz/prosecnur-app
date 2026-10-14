// Lo que la vista previa de «Armar desde» escribe de cada lámina propuesta. Antes
// mostraba el tipo interno de la lámina («p_slide_1_grafico») bajo cada título, y como título de las láminas de varios
// temas que todavía no tienen enunciado.
import type { SlideType } from "../../../api/graficos";
import { rotuloRanuras } from "../laminas/selectores/tiposLamina";

/** El título de la lámina, o qué falta para tenerlo; nunca su tipo interno. */
export function tituloPropuesto(titulo: unknown, queSale = ""): string {
  const t = typeof titulo === "string" ? titulo.trim() : "";
  if (t) return t;
  // Sin título escrito, el PowerPoint titula con la pregunta: la vista previa dice ese mismo título (como la tira y la
  // Estructura), no «Sin título» 59 veces.
  if (queSale.trim()) return queSale.trim();
  return "Sin título";
}

/** Bajo el título: qué lleva la lámina («1 gráfico», «2 gráficos y 3 cifras»). */
export function contenidoPropuesto(tipo: SlideType): string {
  return rotuloRanuras(tipo);
}
