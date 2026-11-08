// Segmentado «Insertar detrás / Cambiar esta lámina» en la cabecera del selector (auditoría del selector, hallazgo 14).
// El modo deja de ser implícito: arranca en el que pidió quien abrió el diálogo y el analista lo cambia aquí. Sin lámina
// en el foco, «Cambiar esta lámina» queda inactivo. Radiogroup del kit: flechas recorren, el foco sigue a la elección.

import type { ButtonHTMLAttributes } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { MODOS_LAMINA } from "./modoYComparacion";
import type { ModoSelectorLamina } from "./selectoresStore";
import "./controlModo.css";

type Props = {
  modo: ModoSelectorLamina;
  hayLamina: boolean;
  onModo: (modo: ModoSelectorLamina) => void;
};

export function ControlModoLamina({ modo, hayLamina, onModo }: Props) {
  return (
    <GlidingRadioGroup
      value={modo}
      options={MODOS_LAMINA}
      getOptionValue={(o) => o.valor}
      onValueChange={onModo}
      className="pulso-f6-modo"
      aria-label="Insertar o cambiar la lámina"
      data-qa-geometry-group="graficos/f6-selector-modo"
      data-qa-geometry-contract="equal"
      getOptionProps={(o) => {
        const props: ButtonHTMLAttributes<HTMLButtonElement> & { [dato: `data-${string}`]: string } = {
          disabled: o.valor === "cambiar" && !hayLamina,
          "data-modo-lamina": o.valor,
          "data-qa-geometry-member": "",
        };
        return props;
      }}
    >
      {(o) => <span>{o.rotulo}</span>}
    </GlidingRadioGroup>
  );
}
