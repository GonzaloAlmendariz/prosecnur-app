// Barra «Comparar» de la cabecera de la galería: cuántas tarjetas hay marcadas (tope de dos) y el botón que abre la
// vista partida. Con una sola, el botón queda inactivo y lo dice. Solo aparece con alguna tarjeta marcada.

import { Columns2 } from "../../../../vendor/lucide-react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { TOPE_COMPARAR } from "./modoYComparacion";
import "./comparar.css";

type Props = {
  marcadas: number;
  onVer: () => void;
};

export function BarraComparar({ marcadas, onVer }: Props) {
  if (marcadas === 0) return null;
  const lista = marcadas >= TOPE_COMPARAR;
  return (
    <div className="pulso-f6-barra-comparar" data-barra-comparar="">
      <span aria-live="polite">{`Comparar: ${marcadas} de ${TOPE_COMPARAR}`}</span>
      <PulsoButton
        variant={lista ? "primary" : "secondary"}
        size="sm"
        aria-disabled={!lista || undefined}
        title={lista ? undefined : "Marca otra lámina para comparar"}
        onClick={() => { if (lista) onVer(); }}
        data-ver-comparacion=""
      >
        <Columns2 size={14} aria-hidden="true" />
        Ver lado a lado
      </PulsoButton>
    </div>
  );
}
