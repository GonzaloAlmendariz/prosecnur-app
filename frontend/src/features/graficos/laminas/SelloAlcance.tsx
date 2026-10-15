// Marca «Sólo este gráfico» de un ajuste de la tarjeta (O7b del rediseño, 2026-10-15; pedido de Gonzalo: que se sepa si
// un cambio es particular o vale para todos los gráficos del mismo tipo). Sin marca, el ajuste viene del tipo. Con ella,
// un clic ofrece llevarlo a todos los gráficos del tipo o volver al valor del tipo. Al aplicar, la marca desaparece y el
// menú se desmonta con ella.

import { Popover } from "../../../components/Popover";

type Props = {
  /** Nombre del tipo en plural o como lo dice la app («barras apiladas»). */
  nombreTipo: string;
  /** Cuántos gráficos de ese tipo tiene el informe. */
  nTipo: number;
  ajuste: string;
  onAplicarTipo: () => void;
  onVolver: () => void;
};

export function SelloAlcance({ nombreTipo, nTipo, ajuste, onAplicarTipo, onVolver }: Props) {
  return (
    <Popover
      align="end"
      ariaLabel={`Alcance de ${ajuste}`}
      className="pulso-f6-alcance-menu"
      trigger={
        <button type="button" className="pulso-f6-alcance" aria-haspopup="menu" title={`${ajuste}: sólo este gráfico`}>
          Sólo este gráfico
        </button>
      }
    >
      <div role="menu" className="pulso-f6-alcance-opciones">
        <button type="button" role="menuitem" className="is-principal" onClick={onAplicarTipo}>
          Aplicar a {nTipo > 1 ? `los ${nTipo} gráficos` : "todos los gráficos"} de {nombreTipo}
        </button>
        <button type="button" role="menuitem" onClick={onVolver}>Volver al valor del tipo</button>
      </div>
    </Popover>
  );
}
