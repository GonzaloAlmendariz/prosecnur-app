/**
 * Elección excluyente de dos o tres opciones con la forma del segmentado del
 * prototipo (`pp-seg`): fondo hundido y la opción elegida en relieve. El grupo
 * es el del kit (`GlidingRadioGroup`): una sola parada de tabulador y las
 * flechas eligen.
 */
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";

export type OpcionDeSegmentado<T extends string> = { valor: T; rotulo: string };

export function Segmentado<T extends string>({
  etiqueta,
  valor,
  opciones,
  onCambio,
  ancho = false,
}: {
  etiqueta: string;
  valor: T;
  opciones: readonly OpcionDeSegmentado<T>[];
  onCambio: (valor: T) => void;
  /** Ocupa todo el ancho y reparte las opciones. */
  ancho?: boolean;
}) {
  return (
    <GlidingRadioGroup<OpcionDeSegmentado<T>, string>
      className={ancho ? "pulso-regla-segmentado pulso-regla-segmentado--ancho" : "pulso-regla-segmentado"}
      aria-label={etiqueta}
      value={valor}
      options={opciones}
      getOptionValue={(o) => o.valor}
      onValueChange={(elegido) => {
        const opcion = opciones.find((o) => o.valor === elegido);
        if (opcion) onCambio(opcion.valor);
      }}
      getOptionProps={(_o, { checked }) => ({ className: checked ? "is-on" : undefined })}
    >
      {(o) => o.rotulo}
    </GlidingRadioGroup>
  );
}
