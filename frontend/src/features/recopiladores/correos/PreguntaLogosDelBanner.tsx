import { PulsoButton } from "../../../components/PulsoButton";
import { Check } from "../../../vendor/lucide-react";

import "./correosIdentidad.css";

export const PREGUNTA_LOGOS = "¿Este banner ya trae los logos?";
export const QUITAR_FRANJA = "Quitar la franja de logos";

type Props = {
  /** Lo declarado en `images[id].trae_logos`; `undefined` es «no se sabe» y se pregunta. */
  traeLogos: boolean | undefined;
  /** Con la franja de logos en el correo, «Sí» ofrece quitarla; `null` si desde aquí no se puede. */
  onQuitarFranja: (() => void) | null;
  /** `undefined` vuelve a preguntar («cambiar»). */
  onResponder: (valor: boolean | undefined) => void;
};

/**
 * Una línea para el banner recién subido: si ya trae los logos del estudio
 * incrustados, la franja de logos los repetiría. La respuesta queda en la
 * imagen y se cambia con un clic. Sin hooks: el estado es el de la plantilla.
 */
export function PreguntaLogosDelBanner({ traeLogos, onQuitarFranja, onResponder }: Props) {
  if (traeLogos === undefined) {
    return (
      <div className="rec-ident-trae-logos" role="group" aria-label={PREGUNTA_LOGOS}>
        <span className="rec-ident-trae-logos-texto">{PREGUNTA_LOGOS}</span>
        <span className="rec-ident-trae-logos-acciones">
          <PulsoButton variant="secondary" size="sm" onClick={() => onResponder(true)}>Sí</PulsoButton>
          <PulsoButton variant="secondary" size="sm" onClick={() => onResponder(false)}>No</PulsoButton>
        </span>
      </div>
    );
  }
  return (
    <div className="rec-ident-trae-logos is-respondida" role="group" aria-label="Logos del banner">
      <span className="rec-ident-trae-logos-texto" role="status">
        {traeLogos ? <Check size={13} aria-hidden /> : null}
        {traeLogos ? "Ya trae los logos" : "No trae los logos"}
        <span aria-hidden> · </span>
        <button
          type="button"
          className="rec-mail-link"
          aria-label={`Cambiar: ${traeLogos ? "ya trae los logos" : "no trae los logos"}`}
          onClick={() => onResponder(undefined)}
        >
          cambiar
        </button>
      </span>
      {traeLogos && onQuitarFranja ? (
        <span className="rec-ident-trae-logos-acciones">
          <PulsoButton variant="secondary" size="sm" onClick={onQuitarFranja}>{QUITAR_FRANJA}</PulsoButton>
        </span>
      ) : null}
    </div>
  );
}
