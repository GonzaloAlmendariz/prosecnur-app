// Cuántas fuentes o bases se preparan a la vez (antes "Entradas previstas" de
// `CargaSourcesPlan`). Los asistentes de varias fuentes y varias encuestas
// topan con este número, así que va en el mismo paso, antes del asistente.

import { useId } from "react";
import { PulsoField } from "../../../../components/PulsoField";
import { PulsoInput } from "../../../../components/PulsoInput";
import type { MultiBaseStrategy } from "../../store";
import { acotarEntradas, ayudaDeEntradas, entradasPrevistasDe } from "./agregarBaseModel";

export function EntradasPrevistas({
  estrategia,
  valor,
  minimo,
  existentes,
  ocupado,
  onCambio,
}: {
  estrategia: MultiBaseStrategy;
  valor: number;
  /** El piso del número (`previstasVisibles`): no se planea por debajo. */
  minimo: number;
  /** Las que ya están en el estudio, para decir lo que resulta. */
  existentes: number;
  ocupado: boolean;
  onCambio: (valor: number) => void;
}) {
  const id = useId();
  const { rotulo, maximo } = entradasPrevistasDe(estrategia);
  const piso = Math.max(1, minimo);
  return (
    <div className="pulso-bases-entradas">
      <PulsoField label={rotulo} hint={ayudaDeEntradas(estrategia, piso, maximo, existentes)} id={id}>
        <PulsoInput
          size="sm"
          type="number"
          inputMode="numeric"
          min={piso}
          max={maximo}
          value={valor}
          disabled={ocupado}
          onChange={(e) => onCambio(acotarEntradas(Number(e.target.value), piso, maximo))}
        />
      </PulsoField>
    </div>
  );
}
