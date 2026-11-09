// La barra de elección del mazo «Resumen ejecutivo»: cuántas de las propuestas están elegidas (anunciado en vivo, para
// quien no ve las casillas cambiar) y los dos atajos, «Elegir todas» y «Ninguna». El mazo arranca sin elegir.

import { PulsoButton } from "../../../../components/PulsoButton";
import { textoElegidas } from "./modeloMazo";

type Props = {
  elegidas: number;
  total: number;
  onTodas: () => void;
  onNinguna: () => void;
};

export function SeleccionMazo({ elegidas, total, onTodas, onNinguna }: Props) {
  return (
    <div className="pulso-f6-mazo-seleccion" role="group" aria-label="Elección de láminas"
      data-qa-geometry-group="graficos/f6-mazo-seleccion" data-qa-geometry-contract="intrinsic">
      <span className="pulso-f6-mazo-seleccion-conteo" aria-live="polite" data-qa-geometry-member>
        {textoElegidas(elegidas, total)}
      </span>
      <span className="pulso-f6-mazo-seleccion-acciones pulso-enlaces" data-qa-geometry-member>
        <PulsoButton variant="link" size="sm" onClick={onTodas} disabled={elegidas === total}>Elegir todas</PulsoButton>
        <PulsoButton variant="link" size="sm" onClick={onNinguna} disabled={elegidas === 0}>Ninguna</PulsoButton>
      </span>
    </div>
  );
}
