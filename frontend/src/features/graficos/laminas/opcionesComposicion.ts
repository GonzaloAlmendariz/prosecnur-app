// Lo que el dibujo de la composición (inspector y tira de miniaturas) refleja de cada gráfico de la lámina. Hoy sólo el
// radar entre públicos: su forma real (líneas y puntos, barras o telaraña) y su tabla, no siempre la telaraña con tabla.
import type { Slide } from "../../../api/graficos";
import type { OpcionesGlifo } from "../iconos/glifosGrafico";
import { ajustesDelGlifo } from "./maqueta/fichaModelo";
import { graficosDeLamina } from "./selectores/cambioTipoLamina";

/** Opciones del glifo por slot; sólo los slots cuyo gráfico cambia de forma con sus ajustes. */
export function opcionesDeComposicion(slide: Pick<Slide, "tipo" | "payload">): Record<string, OpcionesGlifo> {
  const salida: Record<string, OpcionesGlifo> = {};
  for (const { slot, grafico } of graficosDeLamina(slide)) {
    if (grafico.graficador !== "p_radar") continue;
    const { glifo } = ajustesDelGlifo("p_radar", (grafico.args ?? {}) as Record<string, unknown>, false);
    salida[slot] = { formaRadar: glifo.formaRadar, tabla: glifo.tabla };
  }
  return salida;
}
