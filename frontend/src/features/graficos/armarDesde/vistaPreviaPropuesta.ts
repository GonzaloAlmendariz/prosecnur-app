// Lo que la vista previa de «Armar desde» escribe de cada lámina propuesta y de lo que quedó fuera del mazo. Antes
// mostraba el tipo interno de la lámina («p_slide_1_grafico») bajo cada título, y como título de las láminas de varios
// temas que todavía no tienen enunciado; y los motivos sin traducir («1 no_graficable»).
import type { SlideType } from "../../../api/graficos";
import { rotuloRanuras } from "../laminas/selectores/tiposLamina";

const MOTIVOS_FUERA: Record<string, [string, string]> = {
  sin_diapositiva: ["tema sin lámina asignada", "temas sin lámina asignada"],
  escala_divergente: ["tema con escalas distintas entre públicos", "temas con escalas distintas entre públicos"],
  sin_variables: ["tema sin variables", "temas sin variables"],
  no_graficable: ["pregunta numérica, que necesita tramos", "preguntas numéricas, que necesitan tramos"],
  sin_confirmar: ["tema sin confirmar", "temas sin confirmar"],
  release_no_aprobada: ["tema de una base sin aprobar", "temas de bases sin aprobar"],
};

/** «Fuera del informe: 1 pregunta numérica, que necesita tramos; 2 temas sin diapositiva asignada.» */
export function textoFueraDelMazo(fuera: readonly { motivo: string }[]): string {
  const porMotivo = new Map<string, number>();
  for (const f of fuera) porMotivo.set(f.motivo, (porMotivo.get(f.motivo) ?? 0) + 1);
  const partes = [...porMotivo].map(([motivo, n]) => {
    const [uno, varios] = MOTIVOS_FUERA[motivo] ?? ["tema que no entra", "temas que no entran"];
    return `${n} ${n === 1 ? uno : varios}`;
  });
  return partes.length ? `Fuera del informe: ${partes.join("; ")}.` : "";
}

/** El título de la lámina, o qué falta para tenerlo; nunca su tipo interno. */
export function tituloPropuesto(titulo: unknown, equivalencias: boolean, queSale = ""): string {
  const t = typeof titulo === "string" ? titulo.trim() : "";
  if (t) return t;
  // Sin título escrito, el PowerPoint titula con la pregunta: la vista previa dice ese mismo título (como la tira y la
  // Estructura), no «Sin título» 59 veces.
  if (queSale.trim()) return queSale.trim();
  return equivalencias ? "Sin título: escribe su enunciado en Carga › Equivalencias" : "Sin título";
}

/** Bajo el título: qué lleva la lámina («1 gráfico», «2 gráficos y 3 cifras»). */
export function contenidoPropuesto(tipo: SlideType): string {
  return rotuloRanuras(tipo);
}
