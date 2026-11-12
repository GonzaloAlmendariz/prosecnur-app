import { PulsoField } from "../../../components/PulsoField";
import { PulsoSelect } from "../../../components/PulsoSelect";
import "./selectorDeBase.css";

export type SelectorDeBaseCargaProps = {
  bases: readonly string[];
  elegida: string;
  onCambiar: (nombre: string) => void;
  deshabilitado?: boolean;
  /** Lo que se lee de cada base (`etiquetaDeBase`); sin él, su nombre. */
  etiquetas?: Readonly<Record<string, string>>;
};

/**
 * El selector de base de las pestañas de Carga (ADR 0142): uno solo para
 * Revisión, Variables, Formulario y Respuestas, con el select del kit. Con una
 * sola opción no hay nada que elegir y no se pinta.
 */
export function SelectorDeBaseCarga({ bases, elegida, onCambiar, deshabilitado = false, etiquetas }: SelectorDeBaseCargaProps) {
  if (bases.length < 2) return null;
  return (
    <div className="pulso-carga-selector-base">
      <PulsoField label="Base" inline>
        <PulsoSelect
          size="sm"
          // Siempre controlado: con `undefined` mientras no hay base elegida, el select pasaba de no
          // controlado a controlado al llegar la primera (aviso de React).
          value={elegida}
          onValueChange={onCambiar}
          disabled={deshabilitado}
          options={bases.map((nombre) => ({ value: nombre, label: etiquetas?.[nombre] ?? nombre }))}
        />
      </PulsoField>
    </div>
  );
}
