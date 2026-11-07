// El aviso de lo que no pasa a la lámina nueva al cambiar su tipo o su tarjeta (F6.2; dirección F6 §4.3: «lo dice antes
// de aplicar»). Lo comparten el detalle de una composición y el de una tarjeta por intención.

import { AlertTriangle } from "../../../../vendor/lucide-react";
import type { GraficadorRef } from "../../../../api/graficos";
import type { GraficoEnSlot } from "./cambioTipoLamina";

type Props = {
  id: string;
  sobrantes: readonly GraficoEnSlot[];
  textos: readonly string[];
  confirmando: boolean;
  nombreGrafico: (g: GraficadorRef) => string;
  nombreSlot: (slot: string) => string;
  nombreCampo: (clave: string) => string;
};

export function AvisoCambio({ id, sobrantes, textos, confirmando, nombreGrafico, nombreSlot, nombreCampo }: Props) {
  if (!sobrantes.length && !textos.length) return null;
  return (
    <div className="pulso-f6-aviso-cambio" id={id} role={confirmando ? "alert" : undefined}>
      <strong>
        <AlertTriangle size={14} aria-hidden="true" />{" "}
        {confirmando ? "Confirma el cambio: esto no pasa a la lámina nueva" : "Al cambiar, esto no pasa a la lámina nueva"}
      </strong>
      <ul>
        {sobrantes.map((g) => (
          <li key={g.slot}>{nombreGrafico(g.grafico)} <span>(ranura {nombreSlot(g.slot)})</span></li>
        ))}
        {textos.map((t) => <li key={t}>Texto “{nombreCampo(t)}”</li>)}
      </ul>
      <span>Los demás gráficos se conservan. Puedes deshacerlo después.</span>
    </div>
  );
}
