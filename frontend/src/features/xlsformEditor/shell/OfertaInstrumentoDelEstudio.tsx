import type { InstrumentoDelEstudio } from "../../../api/xlsformEditor";
import { Alert } from "../../../components/Alert";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";

/** «El estudio tiene su instrumento»: lo abre como un formulario más de la biblioteca (hallazgo 12). */
export function OfertaInstrumentoDelEstudio({ instrumento, abriendo, puedeCrear, onAbrir }: {
  instrumento: InstrumentoDelEstudio;
  abriendo: boolean;
  /** Sin cupo en la biblioteca no se puede agregar. */
  puedeCrear: boolean;
  onAbrir: () => void;
}) {
  const preguntas = `${formatoConteo(instrumento.n_questions)} ${instrumento.n_questions === 1 ? "pregunta" : "preguntas"}`;
  return (
    <div className="pulso-xf-home-instrumento" role="region" aria-label="Instrumento del estudio">
      <Alert kind="info">
        <p>
          El estudio ya tiene su instrumento, {instrumento.nombre || "el de la base"} ({preguntas}), y la biblioteca
          todavía no lo trae. Ábrelo para editarlo aquí; los formularios que ya hay se quedan como están.
        </p>
        <div className="pulso-xf-home-instrumento-acciones">
          <PulsoButton variant="primary" size="sm" onClick={onAbrir} disabled={abriendo || !puedeCrear}>
            {abriendo ? "Abriendo el instrumento…" : "Abrir el instrumento del estudio"}
          </PulsoButton>
          {!puedeCrear ? <span>La biblioteca está llena: elimina un formulario para abrirlo.</span> : null}
        </div>
      </Alert>
    </div>
  );
}
