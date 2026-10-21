import { useId, type ChangeEvent } from "react";

import { Upload } from "../../../vendor/lucide-react";

type Props = {
  etiqueta: string;
  disabled: boolean;
  onArchivo: (file: File) => void;
  /** Nombre accesible si la etiqueta visible no basta («Subir el logo de Pulso PUCP»). */
  ariaLabel?: string;
};

/** Botón que abre el selector de archivo para un PNG o JPEG del correo. */
export function SubirArchivo({ etiqueta, disabled, onArchivo, ariaLabel }: Props) {
  const id = useId();
  const alElegir = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onArchivo(file);
  };
  return (
    <span className={`rec-mail-subir${disabled ? " is-disabled" : ""}`}>
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        className="pulso-sr-only"
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={alElegir}
      />
      <label htmlFor={id} className="pulso-button pulso-button--secondary pulso-button--sm" title="PNG o JPEG">
        <Upload size={14} aria-hidden /> {etiqueta}
      </label>
    </span>
  );
}
