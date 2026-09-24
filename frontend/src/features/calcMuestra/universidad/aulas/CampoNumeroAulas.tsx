/**
 * Campo numérico de los parámetros del sorteo: rótulo visible, NumberCell y
 * ayuda, con el rótulo ASOCIADO al input (E12 · A7). El marcado es el mismo
 * que antes —`div.cmv2-compact-field > span + label.cmv2-number-cell + em`—,
 * así que el CSS y el contrato geométrico de la grilla no cambian; lo único
 * nuevo son los ids que atan el `<span>` y el `<em>` al `<input>`.
 */
import { useId, type ReactNode } from "react";
import { NumberCell } from "./NumberCell";

export function CampoNumeroAulas({
  rotulo,
  ayuda,
  value,
  onChange,
  min,
  step,
}: {
  rotulo: string;
  ayuda?: ReactNode;
  value: number | null | undefined;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  const base = useId();
  const rotuloId = `${base}-rotulo`;
  const ayudaId = `${base}-ayuda`;
  return (
    <div className="cmv2-compact-field">
      <span id={rotuloId}>{rotulo}</span>
      <NumberCell
        value={value}
        onChange={onChange}
        min={min}
        step={step}
        ariaLabelledBy={rotuloId}
        ariaDescribedBy={ayuda ? ayudaId : undefined}
      />
      {ayuda ? <em id={ayudaId}>{ayuda}</em> : null}
    </div>
  );
}
