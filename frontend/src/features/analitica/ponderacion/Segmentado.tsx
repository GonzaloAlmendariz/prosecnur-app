// Elección excluyente de dos a cuatro opciones. El grupo es el del kit
// (`GlidingRadioGroup`): una sola parada de tabulador, que entra a la opción
// elegida, y las flechas recorren y eligen. Aquí solo se le da la piel del
// segmentado de Analítica (`.analitica-segmented`, la misma de "De dónde sale
// el peso" y "Población"), donde la opción elegida pinta su propio relleno.

import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";

export type OpcionDeSegmentado<T extends string> = {
  valor: T;
  rotulo: string;
  /** La consecuencia de elegirla, cuando no se ve en la pantalla. Va al `title`. */
  ayuda?: string;
};

export function Segmentado<T extends string>({ etiqueta, etiquetadoPor, valor, opciones, onCambio }: {
  /** Nombre accesible del grupo cuando no hay un rótulo visible al que apuntar. */
  etiqueta?: string;
  /** `id` del rótulo visible que nombra al grupo. */
  etiquetadoPor?: string;
  /** `null` mientras no se eligió ninguna. */
  valor: T | null;
  opciones: readonly OpcionDeSegmentado<T>[];
  onCambio: (valor: T) => void;
}) {
  return (
    <GlidingRadioGroup<OpcionDeSegmentado<T>, string>
      className="analitica-segmented"
      aria-label={etiquetadoPor ? undefined : etiqueta}
      aria-labelledby={etiquetadoPor}
      value={valor ?? ""}
      options={opciones}
      getOptionValue={(o) => o.valor}
      onValueChange={(elegido) => onCambio(elegido as T)}
      getOptionProps={(o, { checked }) => ({ className: checked ? "is-on" : undefined, title: o.ayuda })}
    >
      {(o) => o.rotulo}
    </GlidingRadioGroup>
  );
}
