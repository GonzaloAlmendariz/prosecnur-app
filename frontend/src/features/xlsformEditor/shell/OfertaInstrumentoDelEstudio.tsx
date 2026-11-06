import type { InstrumentoDelEstudio } from "../../../api/xlsformEditor";
import { Alert } from "../../../components/Alert";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import "./ofertaInstrumento.css";

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
        {/* 5 nov 2026 (pulido de UI): una línea con la acción al costado. Antes eran dos renglones de texto y
            el botón en una fila propia, sobre una grilla de tarjetas que ya decía que no hay otros. */}
        <p>
          El instrumento del estudio, <strong>{instrumento.nombre || "el de la base"}</strong> ({preguntas}), todavía
          no está en la biblioteca.
        </p>
        <div className="pulso-xf-home-instrumento-acciones">
          <PulsoButton variant="primary" size="sm" onClick={onAbrir} disabled={abriendo || !puedeCrear}>
            {abriendo ? "Abriendo…" : "Abrirlo aquí"}
          </PulsoButton>
          {!puedeCrear ? <span>La biblioteca está llena: elimina un formulario para abrirlo.</span> : null}
        </div>
      </Alert>
    </div>
  );
}
