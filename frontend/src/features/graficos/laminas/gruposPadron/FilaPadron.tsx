// El padrón de un grupo o público con su interruptor «Padrón confiable» (maqueta graficos-sintesis, Grupos). Apagado,
// el número queda escrito pero la base sale sólo con n: el padrón de un subgrupo suele no ser confiable.

import { useId } from "react";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { numeroDePadron, type Padron } from "./modeloPadron";

type Props = {
  /** El grupo o público, para los nombres accesibles («Padrón de Docentes TC»). */
  nombre: string;
  padron: Padron;
  onCambio: (p: Padron) => void;
};

export function FilaPadron({ nombre, padron, onCambio }: Props) {
  const id = useId();
  return (
    <div className="pulso-f6-padron">
      <label className="pulso-f6-padron-rotulo" htmlFor={id}>Padrón</label>
      <PulsoInput id={id} size="sm" numeric inputMode="numeric" autoComplete="off" aria-label={`Padrón de ${nombre}`}
        value={padron.valor === null ? "" : String(padron.valor)} placeholder="Sin padrón"
        onChange={(e) => onCambio({ valor: numeroDePadron(e.target.value), confiable: padron.confiable })} />
      <PulsoSwitch size="sm" label="Padrón confiable" ariaLabel={`Padrón confiable de ${nombre}`}
        checked={padron.valor !== null && padron.confiable} disabled={padron.valor === null}
        onCheckedChange={(v) => onCambio({ valor: padron.valor, confiable: v })} />
    </div>
  );
}
