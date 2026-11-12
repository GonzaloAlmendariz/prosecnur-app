// Un ajuste del archivo con opciones excluyentes (prototipo, "Ajustes del
// archivo" de Cruces): el rótulo de la sección y un grupo deslizante que se
// recorre con las flechas. La opción que no aplica queda deshabilitada y dice
// por qué en su `title`.

import { useId } from "react";

import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { SeccionDeAjustes } from "../tablas/SeccionDeAjustes";

export type OpcionDeAjuste<V extends string> = {
  valor: V;
  rotulo: string;
  /** Por qué no aplica; con texto, la opción queda deshabilitada. */
  noAplica?: string;
};

export function EleccionDeAjuste<V extends string>({ titulo, valor, opciones, onCambio }: {
  titulo: string;
  valor: V;
  opciones: readonly OpcionDeAjuste<V>[];
  onCambio: (valor: V) => void;
}) {
  const id = useId();
  return (
    <SeccionDeAjustes titulo={titulo} idDelTitulo={id}>
      <GlidingRadioGroup
        value={valor}
        options={opciones}
        getOptionValue={(o) => o.valor}
        onValueChange={onCambio}
        getOptionProps={(o, { checked }) => ({
          className: checked ? "is-on" : undefined,
          ...(o.noAplica ? { disabled: true, title: o.noAplica } : {}),
        })}
        className="analitica-segmented entrega-eleccion"
        aria-labelledby={id}
      >
        {(o) => <span>{o.rotulo}</span>}
      </GlidingRadioGroup>
    </SeccionDeAjustes>
  );
}
