// Lo que cambió al cargar la versión nueva de las respuestas, y el paso que
// sigue. Lo usan los dos reemplazos: «Reemplazar respuestas» (una base) y
// «Nueva versión» (varias bases). Si la base tenía codificación, reemplazar
// descartó su adaptación (ADR 0100 D3): el aviso lleva a Adaptación.

import { useInRouterContext, useNavigate } from "react-router-dom";
import type { CambiosDeRespuestas } from "../../../api/estudio";
import { PulsoButton } from "../../../components/PulsoButton";
import { resumenCambiosDeRespuestas } from "./nuevaVersionRespuestasModel";
import "./basesDelEstudio.css";

const ADAPTACION = "/codificacion?pestana=adaptar";

function IrAAdaptacion() {
  const navigate = useNavigate();
  return (
    <PulsoButton variant="secondary" size="sm" onClick={() => navigate(ADAPTACION)}>
      Ir a Adaptación
    </PulsoButton>
  );
}

export function CambiosDeRespuestasAviso({
  cambios,
  archivo,
  onCerrar,
}: {
  cambios: CambiosDeRespuestas;
  archivo?: string;
  onCerrar: () => void;
}) {
  const conRouter = useInRouterContext();
  return (
    <div className="pulso-bde-version-resultado" role="status">
      <strong>Respuestas actualizadas{archivo ? ` desde ${archivo}` : ""}</strong>
      {resumenCambiosDeRespuestas(cambios).map((linea) => <span key={linea}>{linea}</span>)}
      {cambios.codificacion_por_readaptar ? (
        <span className="pulso-bde-version-siguiente">
          Siguiente: la codificación se conservó, pero hay que volver a adaptarla a estas respuestas.
        </span>
      ) : null}
      <span className="pulso-bde-version-acciones">
        {cambios.codificacion_por_readaptar && conRouter ? <IrAAdaptacion /> : null}
        <PulsoButton variant="ghost" size="sm" onClick={onCerrar}>Entendido</PulsoButton>
      </span>
    </div>
  );
}
