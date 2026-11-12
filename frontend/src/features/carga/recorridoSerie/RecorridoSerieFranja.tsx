import { Link } from "react-router-dom";
import { AlertTriangle, Check, Loader2 } from "../../../vendor/lucide-react";
import { TEXTO_ESTADO, readinessRecorrido, resumenRecorrido, type PasoRecorrido } from "./recorridoSerieModel";
import "./RecorridoSerie.css";
import "./RecorridoSerieFranja.css";

/**
 * El recorrido de la serie en una línea (prototipo "carga-equivalencias",
 * `pp-pasos--serie`): cada paso con su número o su marca y su nombre, unidos
 * por un trazo. El detalle de cada paso va en su `title` y en el texto para
 * lector de pantalla; el enlace lleva a donde se hace.
 */
export function RecorridoSerieFranja({ pasos, hrefDe }: { pasos: readonly PasoRecorrido[]; hrefDe: (paso: PasoRecorrido) => string }) {
  return (
    <section
      className="pulso-recorrido pulso-recorrido--franja"
      aria-label={`Recorrido de la serie: ${resumenRecorrido(pasos)}`}
      data-qa-geometry-member
      data-audit-ready={readinessRecorrido(pasos)}
      data-surface-contract="carga-recorrido-serie"
    >
      <ol className="pulso-recorrido-franja" data-qa-geometry-group="carga-recorrido-franja" data-qa-geometry-contract="intrinsic">
        {pasos.map((p) => (
          <li key={p.id} className={`pulso-recorrido-franja-paso is-${p.estado}`} data-qa-geometry-member data-paso={p.id}>
            <Link className="pulso-recorrido-franja-enlace" to={hrefDe(p)} title={`${p.titulo}: ${p.detalle}`}>
              <span className="pulso-recorrido-franja-marca" aria-hidden="true">
                {p.estado === "hecho" ? <Check size={12} />
                  : p.estado === "falta" ? <AlertTriangle size={12} />
                  : p.estado === "leyendo" ? <Loader2 size={12} className="pulso-spin" />
                  : p.numero}
              </span>
              <span className="pulso-recorrido-franja-nombre">{p.titulo}</span>
              <span className="pulso-sr-only">{`. ${p.detalle}. ${TEXTO_ESTADO[p.estado]}. Ir a ${p.enlace.etiqueta}.`}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
