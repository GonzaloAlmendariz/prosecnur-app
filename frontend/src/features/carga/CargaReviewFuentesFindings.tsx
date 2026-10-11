import { AlertTriangle, GitCompare } from "../../vendor/lucide-react";
import type { CargaReviewFuentes } from "../../api/client";
import {
  cargaReviewFuentesHallazgos,
  type CargaReviewHallazgoFuente,
  type CargaReviewHallazgoTono,
} from "./cargaReviewFuentesModel";

function FuenteFinding({ hallazgo }: { hallazgo: CargaReviewHallazgoFuente }) {
  const Icon = hallazgo.tono === "incompatible" ? AlertTriangle : GitCompare;
  return (
    <li className={`is-${hallazgo.tono}`} data-carga-review-fuente={hallazgo.key}>
      <Icon size={15} aria-hidden="true" />
      <span>
        <strong>{hallazgo.titulo}</strong>
        {hallazgo.lineas.map((linea, index) => (
          <small key={index} title={linea.completo}>{linea.texto}</small>
        ))}
      </span>
    </li>
  );
}

/**
 * Los `<li>` de las fuentes de una base que junta encuestas (ADR 0094), para
 * insertar en `.pulso-carga-review-findings`. `tonos` deja que el resumen
 * ponga los avisos antes y los datos neutros al final de la lista.
 */
export function CargaReviewFuentesFindings({
  fuentes,
  tonos,
}: {
  fuentes: CargaReviewFuentes | null | undefined;
  tonos: readonly CargaReviewHallazgoTono[];
}) {
  const hallazgos = cargaReviewFuentesHallazgos(fuentes).filter((h) => tonos.includes(h.tono));
  return (
    <>
      {hallazgos.map((hallazgo) => <FuenteFinding key={hallazgo.key} hallazgo={hallazgo} />)}
    </>
  );
}
