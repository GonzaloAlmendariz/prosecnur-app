import { forwardRef, type KeyboardEvent } from "react";
import { PulsoInput } from "../../../components/PulsoInput";
import "./tablaCodificar.css";

export type CampoCodigoProps = {
  /** La respuesta de la fila, para el nombre accesible. */
  respuesta: string;
  texto: string;
  abierta: boolean;
  /** Id del listbox; ausente cuando la lista no tiene opciones. */
  listaId?: string;
  /** Id de la opción resaltada. */
  opcionActiva?: string;
  /** Id del texto que describe las teclas. */
  ayudaId: string;
  marcador: string;
  onEscribir: (texto: string) => void;
  onTecla: (evento: KeyboardEvent<HTMLInputElement>) => void;
  onAbrir: () => void;
  onCerrar: () => void;
};

/**
 * El campo de la fila activa: se escribe el número o parte del nombre de un código. Es un combobox de
 * ARIA; la lista que controla (`ListaCodigos`) va en portal y el foco nunca sale de aquí.
 */
export const CampoCodigo = forwardRef<HTMLInputElement, CampoCodigoProps>(function CampoCodigo(
  { respuesta, texto, abierta, listaId, opcionActiva, ayudaId, marcador, onEscribir, onTecla, onAbrir, onCerrar },
  ref,
) {
  return (
    <PulsoInput
      ref={ref}
      size="sm"
      className="pulso-ct-campo"
      role="combobox"
      aria-label={`Código de "${respuesta}"`}
      aria-expanded={abierta}
      aria-controls={abierta ? listaId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={abierta ? opcionActiva : undefined}
      aria-describedby={ayudaId}
      autoComplete="off"
      spellCheck={false}
      placeholder={marcador}
      value={texto}
      onChange={(evento) => onEscribir(evento.target.value)}
      onKeyDown={onTecla}
      onClick={onAbrir}
      onBlur={onCerrar}
    />
  );
});
