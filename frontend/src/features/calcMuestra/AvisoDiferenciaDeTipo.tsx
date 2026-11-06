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
  // 5 nov 2026 (pulido de UI): una oración en vez de tres. Lo que importa es el choque entre lo que dice el
  // estudio y lo que está guardado; el resto (de dónde sale el tipo) cabe en un paréntesis.
  const fuente = diferencia.origen === "declarado"
    ? <>La ficha declara «{diferencia.tipo}»</>
    : <>El estudio parece «{diferencia.tipo}» (la ficha no declara el tipo)</>;
  return (
    <div className="cmv2-diferencia-tipo" role="status" data-qa-diferencia-tipo={diferencia.desk}>
      <Alert
        kind="warn"
        acciones={
          <>
            <PulsoButton variant="primary" size="sm" onClick={() => onAlinear(diferencia.desk)}>
              Alinear con la ficha
            </PulsoButton>
            <PulsoButton variant="secondary" size="sm" nav onClick={() => navigate(ficha)}>Ver la ficha</PulsoButton>
          </>
        }
      >
        <p>
          {fuente}, que aquí es «{diferencia.titulo}», pero el escenario guardado es «{diferencia.actual}».
        </p>
      </Alert>
    </div>
  );
}
