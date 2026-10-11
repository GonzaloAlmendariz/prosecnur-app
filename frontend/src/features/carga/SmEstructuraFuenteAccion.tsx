import { Link } from "react-router-dom";
import type { EstudioPayload, SurveyMonkeyMultibaseDiff } from "../../api/client";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import {
  equivalenciasDisponibleEnEstudio,
  smTieneInstrumentoDistinto,
} from "./smEstructuraFuente";

/**
 * La línea accionable de una fuente que resultó ser otro instrumento (ADR
 * 0094). Con la pestaña Equivalencias disponible, «Equivalencias» es un enlace
 * a su dirección canónica; sin ella, solo se dice qué hacer.
 */
export function SmInstrumentoDistintoAccion({ hrefEquivalencias }: { hrefEquivalencias: string | null }) {
  return (
    <small className="pulso-sm-instrumento-distinto-accion">
      Impórtala como base separada y relaciónala en{" "}
      {hrefEquivalencias ? <Link to={hrefEquivalencias}>Equivalencias</Link> : "Equivalencias"}.
    </small>
  );
}

export function SmEstructuraFuenteAccion({
  diffs,
  estudio,
}: {
  diffs: readonly Pick<SurveyMonkeyMultibaseDiff, "kind">[] | null | undefined;
  estudio: Pick<EstudioPayload, "topology_declared" | "bases">;
}) {
  const carga = useSeccion("procesamiento");
  if (!smTieneInstrumentoDistinto(diffs)) return null;
  const href = equivalenciasDisponibleEnEstudio(estudio) ? carga.hrefDe("pestana", "equivalencias") : null;
  return <SmInstrumentoDistintoAccion hrefEquivalencias={href} />;
}
