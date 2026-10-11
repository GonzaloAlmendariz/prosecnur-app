import { Link } from "react-router-dom";
import type { EstudioPayload, SurveyMonkeyMultibaseDiff } from "../../api/client";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import {
  equivalenciasDisponibleEnEstudio,
  SM_ACCION_BASE_POR_POSICION,
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
  estudio: Pick<EstudioPayload, "topology_declared" | "processing_mode" | "bases">;
}) {
  const carga = useSeccion("procesamiento");
  // Una base armada por posición se corrige regenerándola; se dice antes que
  // cualquier otra cosa porque sus respuestas viejas están corridas.
  if ((diffs ?? []).some((diff) => diff.kind === "legacy_positional")) {
    return <small className="pulso-sm-instrumento-distinto-accion">{SM_ACCION_BASE_POR_POSICION}</small>;
  }
  if (!smTieneInstrumentoDistinto(diffs)) return null;
  // Copia local del predicado: este diagnóstico no pide el emparejamiento. La
  // fuente única es `equivalencias.disponible` de `apiCargaFuentesEmparejamiento`.
  const href = equivalenciasDisponibleEnEstudio(estudio) ? carga.hrefDe("pestana", "equivalencias") : null;
  return <SmInstrumentoDistintoAccion hrefEquivalencias={href} />;
}
