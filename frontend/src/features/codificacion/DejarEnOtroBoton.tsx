// «Dejar en «Otro»»: los textos de una pregunta que no encajan en ningún grupo
// se entregan en «Otro», y eso es válido. Confirmarlo deja de avisarlo y lo
// cuenta como decidido; se puede deshacer.

import { useState } from "react";
import { apiCodifTextosEnOtro } from "../../api/codificacion";
import { PulsoButton } from "../../components/PulsoButton";

export function DejarEnOtroBoton({ pregunta }: { pregunta: string }) {
  const [hecho, setHecho] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const correr = async (revertir: boolean) => {
    setOcupado(true);
    setError("");
    try {
      await apiCodifTextosEnOtro(pregunta, { revertir });
      setHecho(!revertir);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  if (hecho) {
    return (
      <span className="pulso-codif-en-otro-hecho" role="status">
        Quedan en «Otro»
        <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={() => void correr(true)}>Deshacer</PulsoButton>
      </span>
    );
  }
  return (
    <>
      <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={() => void correr(false)}>Dejar en «Otro»</PulsoButton>
      {error ? <span className="pulso-armon-error" role="alert">{error}</span> : null}
    </>
  );
}
