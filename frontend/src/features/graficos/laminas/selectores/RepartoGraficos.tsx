// «Así pasan tus gráficos» en la ficha de «¿Qué lámina?»: al cambiar la composición, cada gráfico de la lámina con el
// número de la ranura donde queda (el mismo número que dibuja la composición de arriba). Lo que no cabe lo dice el aviso
// del pie, no esta lista.

import type { GraficadorRef } from "../../../../api/graficos";
import type { Reubicacion } from "./cambioTipoLamina";

type Props = {
  conservados: readonly Reubicacion[];
  slots: readonly string[];
  mismoTipo: boolean;
  nombreGrafico: (g: GraficadorRef) => string;
  nombreSlot: (slot: string) => string;
};

export function RepartoGraficos({ conservados, slots, mismoTipo, nombreGrafico, nombreSlot }: Props) {
  if (conservados.length === 0) return null;
  return (
    <section className="pulso-f6-reparto" aria-label={mismoTipo ? "Gráficos de esta lámina" : "Así pasan tus gráficos"}>
      <h4 className="pulso-f6-selector-leyenda">{mismoTipo ? "Gráficos de esta lámina" : "Así pasan tus gráficos"}</h4>
      <ol>
        {conservados.map((r) => {
          const k = slots.indexOf(r.hacia) + 1;
          return (
            <li key={`${r.desde}-${r.hacia}`}>
              <span className="pulso-f6-reparto-num" aria-hidden="true">{k || "·"}</span>
              <span className="pulso-f6-reparto-texto">
                <span className="pulso-f6-reparto-grafico">{nombreGrafico(r.grafico)}</span>
                <span className="pulso-f6-reparto-ranura">{k ? `Ranura ${k} · ${nombreSlot(r.hacia)}` : nombreSlot(r.hacia)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
