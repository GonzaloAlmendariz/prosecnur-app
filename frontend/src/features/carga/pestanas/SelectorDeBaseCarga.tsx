import { PulsoField } from "../../../components/PulsoField";
import { PulsoSelect } from "../../../components/PulsoSelect";
import "./selectorDeBase.css";

export type SelectorDeBaseCargaProps = {
  bases: readonly string[];
  elegida: string;
  onCambiar: (nombre: string) => void;
  deshabilitado?: boolean;
};

/**
 * El selector de base de las pestañas de Carga (ADR 0142): uno solo para
 * Revisión, Variables, Formulario y Respuestas, con el select del kit. Con una
 * sola opción no hay nada que elegir y no se pinta.
 */
export function SelectorDeBaseCarga({ bases, elegida, onCambiar, deshabilitado = false }: SelectorDeBaseCargaProps) {
  if (bases.length < 2) return null;
  return (
    <div className="pulso-carga-selector-base">
      <PulsoField label="Base" inline>
        <PulsoSelect
          size="sm"
          value={elegida || undefined}
          onValueChange={onCambiar}
          disabled={deshabilitado}
          options={bases.map((nombre) => ({ value: nombre, label: nombre }))}
        />
      </PulsoField>
    </div>
  );
}
