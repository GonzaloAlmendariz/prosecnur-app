import { Alert } from "../../components/Alert";
import "./diferenciaDeTipo.css";
import { useNavigate } from "react-router-dom";

import { PulsoButton } from "../../components/PulsoButton";
import { useRutaFichaDelEstudio } from "../estudio/useRutaFichaDelEstudio";
import type { DiferenciaDeTipo } from "./diferenciaDeTipo";
import type { ActiveDesk } from "./sharedCore";

/** Las dos fuentes, nombradas, y una acción para alinear (hallazgo 11 de la auditoría visual). */
export function AvisoDiferenciaDeTipo({ diferencia, onAlinear }: {
  diferencia: DiferenciaDeTipo;
  onAlinear: (desk: ActiveDesk) => void;
}) {
  const navigate = useNavigate();
  const ficha = useRutaFichaDelEstudio();
  const fuente = diferencia.origen === "declarado"
    ? <>La ficha del estudio declara un estudio «{diferencia.tipo}»</>
    : <>El estudio se lee como «{diferencia.tipo}» (la ficha todavía no declara el tipo)</>;
  return (
    <div className="cmv2-diferencia-tipo" role="status" data-qa-diferencia-tipo={diferencia.desk}>
      <Alert kind="warn">
        <p>
          {fuente}, que en Cálculo es «{diferencia.titulo}». El escenario guardado es «{diferencia.actual}».
        </p>
        <div className="cmv2-diferencia-tipo-acciones">
          <PulsoButton variant="primary" size="sm" onClick={() => onAlinear(diferencia.desk)}>
            Alinear con la ficha
          </PulsoButton>
          <PulsoButton variant="secondary" size="sm" nav onClick={() => navigate(ficha)}>Ver la ficha</PulsoButton>
        </div>
      </Alert>
    </div>
  );
}
